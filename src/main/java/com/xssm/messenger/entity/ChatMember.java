package com.xssm.messenger.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatMember {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id")
    private Chat chat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    private String role; // ADMIN, MEMBER
    private LocalDateTime joinedAt;
    @PrePersist void onCreate() { joinedAt = LocalDateTime.now(); }
}