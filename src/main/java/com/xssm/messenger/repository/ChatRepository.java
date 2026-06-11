package com.xssm.messenger.repository;

import com.xssm.messenger.entity.Chat;
import com.xssm.messenger.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ChatRepository extends JpaRepository<Chat, Long> {
    @Query("SELECT c FROM Chat c JOIN c.members m WHERE m.user = :user")
    List<Chat> findByMember(User user);
}