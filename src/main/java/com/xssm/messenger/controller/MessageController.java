package com.xssm.messenger.controller;

import com.xssm.messenger.entity.Message;
import com.xssm.messenger.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService msgService;

    @GetMapping("/{chatId}")
    public ResponseEntity<?> getMessages(@PathVariable Long chatId) {
        List<Message> msgs = msgService.getMessages(chatId);
        List<Map<String, Object>> res = new ArrayList<>();
        for (Message m : msgs) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", m.getId());
            map.put("content", m.getContent());
            map.put("sender", m.getSender().getUsername());
            map.put("time", m.getSentAt().toString());
            map.put("edited", m.isEdited());
            map.put("attachmentUrl", m.getAttachmentUrl());
            map.put("read", m.isRead());
            map.put("deletedForAll", m.isDeletedForAll());
            map.put("expiresAt", m.getExpiresAt() != null ? m.getExpiresAt().toString() : null);
            res.add(map);
        }
        return ResponseEntity.ok(res);
    }

    @PostMapping
    public ResponseEntity<?> sendMessage(@AuthenticationPrincipal UserDetails user,
                                         @RequestParam Long chatId,
                                         @RequestParam(required = false) String content,
                                         @RequestParam(required = false) MultipartFile file,
                                         @RequestParam(required = false) Integer expireInSeconds,
                                         @RequestParam(required = false) Long replyToId) throws IOException {
        String attachmentUrl = null;
        if (file != null && !file.isEmpty()) {
            String uploadDir = "uploads/attachments/";
            Files.createDirectories(Paths.get(uploadDir));
            String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path path = Paths.get(uploadDir + filename);
            file.transferTo(path);
            attachmentUrl = "/uploads/attachments/" + filename;
        }
        LocalDateTime expiresAt = null;
        if (expireInSeconds != null && expireInSeconds > 0) {
            expiresAt = LocalDateTime.now().plusSeconds(expireInSeconds);
        }
        Message msg = msgService.sendMessage(chatId, user.getUsername(), content, attachmentUrl, expiresAt, replyToId);
        
        // Используем имя текущего пользователя, чтобы избежать LazyInitializationException
        return ResponseEntity.ok(Map.of(
            "id", msg.getId(),
            "content", msg.getContent(),
            "sender", user.getUsername(),          // <-- исправлено
            "time", msg.getSentAt().toString(),
            "edited", msg.isEdited(),
            "attachmentUrl", msg.getAttachmentUrl(),
            "read", msg.isRead(),
            "deletedForAll", msg.isDeletedForAll(),
            "expiresAt", msg.getExpiresAt() != null ? msg.getExpiresAt().toString() : null
        ));
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<?> editMessage(@PathVariable Long messageId,
                                         @RequestBody Map<String, String> body) {
        String newContent = body.get("content");
        if (newContent == null || newContent.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "content required"));
        }
        msgService.editMessage(messageId, newContent);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long messageId,
                                           @RequestParam(defaultValue = "false") boolean forAll) {
        msgService.deleteMessage(messageId, forAll);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PutMapping("/{messageId}/read")
    public ResponseEntity<?> markRead(@PathVariable Long messageId) {
        msgService.markAsRead(messageId);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}