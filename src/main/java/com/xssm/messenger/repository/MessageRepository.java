package com.xssm.messenger.repository;

import com.xssm.messenger.entity.Chat;
import com.xssm.messenger.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByChatOrderBySentAtAsc(Chat chat);
    List<Message> findByExpiresAtBeforeAndDeletedForAllFalse(LocalDateTime dateTime);
}