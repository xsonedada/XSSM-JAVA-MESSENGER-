package com.xssm.messenger.controller;

import com.xssm.messenger.entity.User;
import com.xssm.messenger.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserDetails user) {
        User u = userRepo.findByUsername(user.getUsername()).orElseThrow();
        return ResponseEntity.ok(Map.of(
            "username", u.getUsername(),
            "displayName", u.getDisplayName(),
            "email", u.getEmail(),
            "avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : ""
        ));
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam String q) {
        if (q == null || q.trim().length() < 1) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<User> users = userRepo.searchByQuery(q.trim());
        List<Map<String, String>> res = users.stream()
                .limit(10)
                .map(u -> Map.of("username", u.getUsername(), "displayName", u.getDisplayName() != null ? u.getDisplayName() : u.getUsername()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(res);
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@AuthenticationPrincipal UserDetails user,
                                           @RequestBody Map<String, String> body) {
        User u = userRepo.findByUsername(user.getUsername()).orElseThrow();
        if (body.containsKey("displayName")) u.setDisplayName(body.get("displayName"));
        userRepo.save(u);
        return ResponseEntity.ok(Map.of("message", "updated"));
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal UserDetails user,
                                            @RequestBody Map<String, String> body) {
        User u = userRepo.findByUsername(user.getUsername()).orElseThrow();
        if (!passwordEncoder.matches(body.get("currentPassword"), u.getPassword()))
            return ResponseEntity.badRequest().body(Map.of("error", "wrong password"));
        u.setPassword(passwordEncoder.encode(body.get("newPassword")));
        userRepo.save(u);
        return ResponseEntity.ok(Map.of("message", "changed"));
    }

    @PostMapping("/avatar")
    public ResponseEntity<?> uploadAvatar(@AuthenticationPrincipal UserDetails user,
                                          @RequestParam("file") MultipartFile file) throws IOException {
        User u = userRepo.findByUsername(user.getUsername()).orElseThrow();
        String uploadDir = "uploads/avatars/";
        Files.createDirectories(Paths.get(uploadDir));
        String filename = u.getUsername() + "_" + file.getOriginalFilename();
        Path path = Paths.get(uploadDir + filename);
        file.transferTo(path);
        u.setAvatarUrl("/uploads/avatars/" + filename);
        userRepo.save(u);
        return ResponseEntity.ok(Map.of("avatarUrl", u.getAvatarUrl()));
    }
}