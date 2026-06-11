package com.xssm.messenger.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ChatWebSocketHandler extends TextWebSocketHandler {
    private static final ConcurrentHashMap<Long, WebSocketSession> userSessions = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // userId должен быть передан как параметр при подключении
        String query = session.getUri().getQuery();
        if (query != null && query.contains("userId=")) {
            Long userId = Long.parseLong(query.split("userId=")[1].split("&")[0]);
            userSessions.put(userId, session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Обрабатываем входящие сообщения (например, typing)
        Map<String, Object> payload = mapper.readValue(message.getPayload(), Map.class);
        String type = (String) payload.get("type");
        if ("typing".equals(type)) {
            Long chatId = Long.valueOf(payload.get("chatId").toString());
            Long senderId = (Long) payload.get("senderId");
            // рассылаем всем участникам чата, кроме отправителя
            // для этого нужно знать участников чата, можно запросить через сервис
            // Для простоты: у нас нет списка, поэтому пропускаем рассылку.
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        userSessions.values().remove(session);
    }

    public static void sendToUser(Long userId, String payload) {
        WebSocketSession session = userSessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(payload));
            } catch (Exception e) { e.printStackTrace(); }
        }
    }
}