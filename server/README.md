# Giang Hồ — Backend API Service

Dịch vụ Backend REST API cho game **Giang Hồ (jx2-web)** xây dựng bằng **Node.js** và **Express.js** (chuẩn ESM).

---

## 🛠 Cài đặt & Khởi chạy

### 1. Khởi chạy trực tiếp từ thư mục `server/`
```bash
cd server
npm install
npm run dev      # Chế độ phát triển (tự reload với node --watch)
# hoặc
npm start        # Khởi chạy production
```

### 2. Chạy test tự động
```bash
npm --prefix server test
```

Mặc định server sẽ chạy tại: `http://localhost:5000`

---

## ⚙️ Biến môi trường (Environment Variables)

Bạn có thể truyền các biến môi trường khi chạy:
- `PORT`: Cổng chạy API (mặc định: `5000`).
- `HOST`: Host bind (mặc định: `0.0.0.0`).
- `CLIENT_ORIGIN`: Domain frontend cho phép CORS (mặc định: `*`).
- `DATA_PATH`: Đường dẫn file lưu trữ dữ liệu JSON (mặc định: `server/data/db.json`).

Ví dụ:
```bash
PORT=8080 CLIENT_ORIGIN="http://localhost:3000" npm run dev
```

---

## 📡 Danh sách API Endpoints

### 1. Tài khoản & Đăng nhập (Users & Authentication)

#### 🔹 Đăng ký tài khoản
- **URL:** `POST /api/users/register`
- **Body:**
```json
{
  "username": "hiepkhat99",
  "password": "secretpassword123",
  "displayName": "Hiệp Khách Vô Danh"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Đăng ký tài khoản thành công!",
  "data": {
    "user": {
      "id": "user_1700000000_abcd",
      "username": "hiepkhat99",
      "displayName": "Hiệp Khách Vô Danh",
      "createdAt": 1700000000000,
      "lastLogin": null
    },
    "token": "..."
  }
}
```

#### 🔹 Đăng nhập
- **URL:** `POST /api/users/login`
- **Body:**
```json
{
  "username": "hiepkhat99",
  "password": "secretpassword123"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công!",
  "data": {
    "user": {
      "id": "user_1700000000_abcd",
      "username": "hiepkhat99",
      "displayName": "Hiệp Khách Vô Danh",
      "createdAt": 1700000000000,
      "lastLogin": 1700000010000
    },
    "token": "..."
  }
}
```

---

#### 🔹 Lấy hồ sơ hiện tại (dùng để đồng bộ tên hiển thị)
- **URL:** `GET /api/users/me?userId=user_1700000000_abcd`
- **Ghi chú:** đây là nguồn dữ liệu chuẩn (authoritative) cho `displayName`. Client gọi endpoint này khi tải trang để cập nhật lại tên đã cache trong `localStorage`.
- **Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_1700000000_abcd",
      "username": "hiepkhat99",
      "displayName": "Hiệp Khách Vô Danh",
      "createdAt": 1700000000000,
      "lastLogin": 1700000010000
    }
  }
}
```
- **Lỗi:** `400` khi thiếu `userId`, `404` khi tài khoản không còn tồn tại.

---

### 2. Kiểm tra trạng thái máy chủ (Health Check)
- **URL:** `GET /api/health`
- **Response mẫu:**
```json
{
  "status": "ok",
  "service": "jx2-backend",
  "version": "1.0.0",
  "uptime": 12,
  "timestamp": "2026-10-18T03:30:00.000Z"
}
```

---

### 2. Lưu & Tải tiến trình nhân vật (Save Progress)

#### 🔹 Tải tiến trình
- **URL:** `GET /api/save/:playerId`
- **Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "player_01",
    "playerName": "Tiêu Dao Tử",
    "stats": {
      "level": 15,
      "hp": 250,
      "mp": 160,
      "exp": 4500,
      "coins": 3200,
      "kills": 38
    },
    "position": { "x": 450, "y": 620 },
    "questRewarded": true,
    "audioEnabled": true,
    "inventory": {
      "potion_hp": 10,
      "potion_mp": 5
    },
    "updatedAt": 1700000000000
  }
}
```

#### 🔹 Lưu tiến trình (Tự động đồng bộ lên Bảng xếp hạng)
- **URL:** `POST /api/save/:playerId`
- **Ghi chú:** nếu `:playerId` trùng `users.id` của một tài khoản đã đăng ký, `display_name` trong bảng `users` sẽ được dùng làm `playerName` thay cho giá trị client gửi lên (nhờ vậy đổi tên tài khoản là tiến trình đã lưu và bảng xếp hạng tự hiện tên mới). Với khách vãng lai (`guest_*`, id ghép thêm tab), giá trị `playerName` trong body được giữ nguyên.
- **Body:**
```json
{
  "playerName": "Tiêu Dao Tử",
  "stats": {
    "level": 15,
    "hp": 250,
    "mp": 160,
    "exp": 4500,
    "coins": 3200,
    "kills": 38
  },
  "position": { "x": 450, "y": 620 },
  "questRewarded": true,
  "audioEnabled": true,
  "inventory": {
    "potion_hp": 10,
    "potion_mp": 5
  }
}
```

#### 🔹 Xóa tiến trình
- **URL:** `DELETE /api/save/:playerId`

---

### 3. Bảng Xếp Hạng (Leaderboard)

#### 🔹 Xem bảng xếp hạng
- **URL:** `GET /api/leaderboard?sortBy=level&limit=10`
- **Query params:**
  - `sortBy`: `level` (mặc định), `kills`, `coins`, `exp`
  - `limit`: Số lượng kết quả (1 đến 50, mặc định: 10)
- **Response:**
```json
{
  "success": true,
  "data": {
    "sortBy": "level",
    "total": 5,
    "rankings": [
      {
        "playerId": "hero_01",
        "playerName": "Tiêu Phong",
        "level": 50,
        "kills": 280,
        "coins": 99999,
        "exp": 125000,
        "updatedAt": 1700000000000
      }
    ]
  }
}
```

#### 🔹 Gửi điểm trực tiếp lên bảng xếp hạng
- **URL:** `POST /api/leaderboard/submit`
- **Ghi chú:** `playerName` bị bỏ qua nếu `playerId` là `users.id` của tài khoản đã đăng ký — bảng xếp hạng luôn dùng `display_name` trong bảng `users`.
- **Body:**
```json
{
  "playerId": "player_01",
  "playerName": "Độc Cô Cầu Bại",
  "level": 99,
  "kills": 999,
  "coins": 500000,
  "exp": 1000000
}
```

---

### 4. Túi đồ (Inventory)

#### 🔹 Lấy danh sách túi đồ
- **URL:** `GET /api/inventory/:playerId`

#### 🔹 Cập nhật túi đồ
- **URL:** `PUT /api/inventory/:playerId`
- **Body:**
```json
{
  "inventory": {
    "potion_hp": 20,
    "potion_mp": 15,
    "scroll_teleport": 5
  }
}
```

---

## 🛡 Bảo mật & Tính năng chống lỗi
- **Prototype Pollution Defense:** Tự động lọc các thuộc tính nguy hiểm (`__proto__`, `constructor`, `prototype`).
- **Validation Middleware:** Kiểm tra nghiêm ngặt định dạng `playerId` (chỉ chấp nhận `[a-zA-Z0-9_-]`) và các giá trị số học âm / không hợp lệ.
- **Graceful Shutdown:** Bắt tín hiệu `SIGINT` / `SIGTERM` và đóng kết nối HTTP an toàn trước khi dừng.
- **Atomic File Writing:** Ghi dữ liệu file tạm (`.tmp`) rồi rename để đảm bảo dữ liệu không bị hỏng khi mất điện hoặc tắt đột ngột.
