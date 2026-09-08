# API Reference — Referral Tracking Platform

Server URL: `http://localhost:3001`

Barcha himoyalangan so'rovlar uchun header: `Authorization: Bearer <token>`.

---

## 1. Auth

### `POST /auth/login`
- **Tavsif**: Telefon raqam va parol orqali tizimga kirish.
- **Body**:
  ```json
  {
    "phone": "+998900000001",
    "password": "changeme123"
  }
  ```
- **Javob**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "role": "SUPER_ADMIN",
    "userId": 1,
    "fullName": "Super Admin",
    "schoolId": null
  }
  ```

---

## 2. Maktablar (Schools)

### `GET /schools`
- **Ruxsat**: Har qanday autentifikatsiyadan o'tgan foydalanuvchi.
- **Javob**: Maktablar ro'yxati (`school_number`, `name`, `address`, `phone`, va h.k.).

### `POST /schools`
- **Ruxsat**: `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "schoolNumber": "S23",
    "name": "23-sonli umumiy o'rta ta'lim maktabi",
    "shortName": "23-maktab",
    "address": "Toshkent sh., Mirzo Ulug'bek t.",
    "phone": "+998712000000",
    "isActive": true,
    "meta": { "district": "Mirzo Ulug'bek", "type": "public" }
  }
  ```
- **Audit**: `SCHOOL_CREATE`

---

## 3. Foydalanuvchilar (Users)

### `POST /users/director`
- **Ruxsat**: `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "schoolId": 1,
    "fullName": "Alisher Navoiy",
    "phone": "+998901112233",
    "password": "password123",
    "email": "director@example.com",
    "meta": { "hireDate": "2025-09-01" }
  }
  ```
- **Audit**: `DIRECTOR_CREATE`

### `POST /users/teacher`
- **Ruxsat**: `DIRECTOR`, `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "fullName": "O'qituvchi Ismi",
    "phone": "+998909876543",
    "password": "teacherPassword123",
    "meta": { "subject": "Ingliz tili" }
  }
  ```
- **Audit**: `TEACHER_CREATE`

### `POST /users/admin`
- **Ruxsat**: `MANAGER`, `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "fullName": "Admin Ismi",
    "phone": "+998907778899",
    "password": "adminPassword123"
  }
  ```
- **Audit**: `ADMIN_CREATE`

### `GET /users?role=...`
- **Ruxsat**: `SUPER_ADMIN`, `MANAGER`, `DIRECTOR`
- Direktor faqat o'z maktabiga tegishli o'qituvchilarni ko'radi.

---

## 4. O'quvchilar (Students)

### `POST /students`
- **Ruxsat**: `TEACHER`, `ADMIN`, `DIRECTOR`, `MANAGER`, `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "fullName": "Anvar Qodirov",
    "phone": "+998901234567",
    "secondaryPhone": "+998909998877",
    "schoolId": 1,
    "callStatus": "WAITING",
    "studyStatus": "STUDYING",
    "meta": {
      "grade": "9-sinf",
      "course_interest": "IELTS",
      "parent_name": "Qodir aka"
    }
  }
  ```
- **Audit**: `STUDENT_CREATE`

### `GET /students`
- **Ruxsat**: Autentifikatsiyadan o'tganlar (role bo'yicha cheklangan).
- Query parametrlari: `callStatus`, `studyStatus`, `schoolId`, `teacherId`.

### `PATCH /students/:id/call-status`
- **Ruxsat**: `ADMIN`, `DIRECTOR`, `MANAGER`, `SUPER_ADMIN`
- **Body**: `{ "callStatus": "WAITING" | "ACCEPTED" | "REJECTED" }`
- **Audit**: `STUDENT_CALL_STATUS_UPDATE`

### `PATCH /students/:id/study-status`
- **Ruxsat**: `ADMIN`, `DIRECTOR`, `TEACHER`, `MANAGER`, `SUPER_ADMIN`
- **Body**: `{ "studyStatus": "STUDYING" | "STOPPED" }`
- **Audit**: `STUDENT_STUDY_STATUS_UPDATE`

---

## 5. Oylik to'lovlar (Monthly Payments)

### `POST /students/:studentId/monthly-payments`
- **Ruxsat**: `ADMIN`, `DIRECTOR`, `MANAGER`, `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "amountUzs": 500000,
    "paidForMonth": "2025-09",
    "paymentMethod": "CASH",
    "notes": "1-oy to'lovi"
  }
  ```
- Avtomatik ravishda `commission_rules` bo'yicha o'qituvchi va direktor uchun `commissions` yaratiladi.
- **Audit**: `MONTHLY_PAYMENT_CREATE`

---

## 6. Komissiyalar (Commissions)

### `GET /commissions`
- **Ruxsat**: O'qituvchi (faqat o'ziniki), Direktor (o'ziniki), Admin / SuperAdmin (barchasi).
- Query parametrlar: `userId`, `status`.

### `PATCH /commissions/:id/mark-paid`
- **Ruxsat**: `ADMIN`, `SUPER_ADMIN`, `MANAGER`
- Komissiya holatini `PAID` qilib yangilaydi va `paidAt` ga hozirgi vaqtni yozadi.
- **Audit**: `COMMISSION_MARK_PAID`

---

## 7. Komissiya qoidalari (Commission Rules)

### `GET /commission-rules`
- Faol qoidalarni qaytaradi.

### `PUT /commission-rules`
- **Ruxsat**: `SUPER_ADMIN`
- **Body**:
  ```json
  {
    "teacherSignupBonusUzs": 50000,
    "directorSignupBonusUzs": 100000,
    "teacherMonthlyPercent": 1000,
    "directorMonthlyPercent": 500
  }
  ```
- **Audit**: `COMMISSION_RULES_UPDATE`

---

## 8. Audit jurnali (Audit Logs)

### `GET /audit-logs?limit=50&entityType=...&entityId=...`
- **Ruxsat**: `SUPER_ADMIN`, `MANAGER` (barchasi); boshqalar faqat o'z harakatlarini ko'radi.
