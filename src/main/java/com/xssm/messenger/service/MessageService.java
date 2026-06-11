package com.xssm.messenger.service;

import com.xssm.messenger.entity.*;
import com.xssm.messenger.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {
    private final MessageRepository msgRepo;
    private final ChatRepository chatRepo;
    private final UserRepository userRepo;

    @Transactional
    public Message sendMessage(Long chatId, String senderUsername, String content, String attachmentUrl, LocalDateTime expiresAt, Long replyToId) {
        Chat chat = chatRepo.findById(chatId).orElseThrow(() -> new RuntimeException("Чат не найден"));
        User sender = userRepo.findByUsername(senderUsername).orElseThrow(() -> new RuntimeException("Пользователь не найден"));
        Message msg = Message.builder().replyToId(replyToId)
                .chat(chat)
                .sender(sender)
                .content(content != null ? content : "")
                .attachmentUrl(attachmentUrl)
                .edited(false)
                .expiresAt(expiresAt)
                .deletedForAll(false)
                .read(false)
                .build();
        return msgRepo.save(msg);
    }

    @Transactional(readOnly = true)
    public List<Message> getMessages(Long chatId) {
        Chat chat = chatRepo.findById(chatId).orElseThrow(() -> new RuntimeException("Чат не найден"));
        List<Message> msgs = msgRepo.findByChatOrderBySentAtAsc(chat);
        // Удаляем истекшие самоуничтожающиеся сообщения (помечаем удалёнными для всех)
        msgs.forEach(m -> {
            if (m.getExpiresAt() != null && m.getExpiresAt().isBefore(LocalDateTime.now())) {
                m.setDeletedForAll(true);
            }
        });
        return msgs.stream().filter(m -> !m.isDeletedForAll()).toList();
    }

    @Transactional
    public Message editMessage(Long messageId, String newContent) {
        Message msg = msgRepo.findById(messageId).orElseThrow(() -> new RuntimeException("Сообщение не найдено"));
        msg.setContent(newContent);
        msg.setEdited(true);
        return msgRepo.save(msg);
    }

    @Transactional
    public void deleteMessage(Long messageId, boolean forAll) {
        Message msg = msgRepo.findById(messageId).orElseThrow(() -> new RuntimeException("Сообщение не найдено"));
        if (forAll) {
            msg.setDeletedForAll(true);
            msgRepo.save(msg);
        } else {
            msgRepo.delete(msg); // удаление только для себя (физическое удаление)
        }
    }

    @Transactional
    public void markAsRead(Long messageId) {
        Message msg = msgRepo.findById(messageId).orElseThrow(() -> new RuntimeException("Сообщение не найдено"));
        msg.setRead(true);
        msgRepo.save(msg);
    }

    // Планировщик для удаления истекших сообщений (каждую минуту)
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanExpiredMessages() {
        List<Message> expired = msgRepo.findByExpiresAtBeforeAndDeletedForAllFalse(LocalDateTime.now());
        expired.forEach(m -> m.setDeletedForAll(true));
        msgRepo.saveAll(expired);
    }
}