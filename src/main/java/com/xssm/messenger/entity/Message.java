package com.xssm.messenger.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Message {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_id")
    private Chat chat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id")
    private User sender;

    @Column(columnDefinition = "TEXT")
    private String content;

    private boolean edited;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(name = "attachment_url")
    private String attachmentUrl;

    @Column(name = "deleted_for_all")
    private boolean deletedForAll;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Builder.Default
    private boolean read = false;

    @Column(name = "reply_to_id")
    private Long replyToId;

    @PrePersist void onCreate() { sentAt = LocalDateTime.now(); }
}