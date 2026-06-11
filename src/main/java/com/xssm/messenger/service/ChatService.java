package com.xssm.messenger.service;

import com.xssm.messenger.entity.*;
import com.xssm.messenger.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatRepository chatRepo;
    private final UserRepository userRepo;
    private final ChatMemberRepository memberRepo;

    public Chat createChat(String name, boolean isGroup, String creatorUsername, List<String> memberUsernames) {
        User creator = userRepo.findByUsername(creatorUsername)
                .orElseThrow(() -> new RuntimeException("???????????? ?? ??????"));

        if (!isGroup && memberUsernames.size() == 1) {
            String otherUsername = memberUsernames.get(0);
            if (otherUsername.equals(creatorUsername)) {
                throw new RuntimeException("?????? ??????? ??? ? ????? ?????");
            }
            User otherUser = userRepo.findByUsername(otherUsername)
                    .orElseThrow(() -> new RuntimeException("???????????? " + otherUsername + " ?? ??????"));

            Optional<Chat> existing = findPrivateChat(creator, otherUser);
            if (existing.isPresent()) {
                return existing.get();
            }

            Chat chat = Chat.builder()
                    .name("") // ??? ????? ????????????
                    .isGroup(false)
                    .createdBy(creator)
                    .build();
            chat = chatRepo.save(chat);

            memberRepo.save(ChatMember.builder().chat(chat).user(creator).role("ADMIN").build());
            memberRepo.save(ChatMember.builder().chat(chat).user(otherUser).role("MEMBER").build());
            return chat;
        }

        // ????????? ???
        Chat chat = Chat.builder()
                .name(name)
                .isGroup(true)
                .createdBy(creator)
                .build();
        chat = chatRepo.save(chat);

        memberRepo.save(ChatMember.builder().chat(chat).user(creator).role("ADMIN").build());
        for (String uname : memberUsernames) {
            if (!uname.equals(creatorUsername)) {
                User u = userRepo.findByUsername(uname).orElse(null);
                if (u != null) {
                    memberRepo.save(ChatMember.builder().chat(chat).user(u).role("MEMBER").build());
                }
            }
        }
        return chat;
    }

    private Optional<Chat> findPrivateChat(User user1, User user2) {
        List<Chat> chats = chatRepo.findByMember(user1);
        for (Chat c : chats) {
            if (!c.isGroup() && c.getMembers().size() == 2) {
                boolean hasOther = c.getMembers().stream()
                        .anyMatch(m -> m.getUser().getId().equals(user2.getId()));
                if (hasOther) return Optional.of(c);
            }
        }
        return Optional.empty();
    }

    public List<Chat> getUserChats(String username) {
        User user = userRepo.findByUsername(username).orElseThrow();
        return chatRepo.findByMember(user);
    }
}