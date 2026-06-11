package com.xssm.messenger.controller;

import com.xssm.messenger.entity.*;
import com.xssm.messenger.repository.UserRepository;
import com.xssm.messenger.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<?> createChat(@AuthenticationPrincipal UserDetails user,
                                        @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        boolean isGroup = (boolean) body.getOrDefault("isGroup", false);
        List<String> members = (List<String>) body.get("members");
        try {
            Chat chat = chatService.createChat(name, isGroup, user.getUsername(), members);
            return ResponseEntity.ok(Map.of("id", chat.getId(), "name", chat.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/private/{username}")
    public ResponseEntity<?> getOrCreatePrivateChat(@AuthenticationPrincipal UserDetails user,
                                                    @PathVariable String username) {
        try {
            Chat chat = chatService.createChat("", false, user.getUsername(), List.of(username));
            return ResponseEntity.ok(Map.of("id", chat.getId(), "name", chat.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getUserChats(@AuthenticationPrincipal UserDetails user) {
        String currentUsername = user.getUsername();
        User currentUser = userRepository.findByUsername(currentUsername).orElseThrow();
        List<Chat> chats = chatService.getUserChats(currentUsername);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Chat c : chats) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            
            if (!c.isGroup() && c.getMembers().size() == 2) {
                // ?????? ???: ??????? ???????????
                User other = c.getMembers().stream()
                        .map(ChatMember::getUser)
                        .filter(u -> !u.getId().equals(currentUser.getId()))
                        .findFirst().orElse(currentUser);
                String displayName = other.getDisplayName() != null ? other.getDisplayName() : other.getUsername();
                map.put("name", displayName);
                map.put("avatar", Map.of(
                    "type", "letter",
                    "letter", displayName.substring(0, 1).toUpperCase()
                ));
                map.put("isGroup", false);
            } else {
                // ????????? ???
                map.put("name", c.getName());
                map.put("avatar", Map.of("type", "group"));
                map.put("isGroup", true);
            }
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }
}