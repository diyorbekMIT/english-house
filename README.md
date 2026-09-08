# Referral Tracking Platform

Toshkentdagi ta'lim markazi uchun o'quvchilar va referallarni kuzatish tizimi (Referral Tracking System).

## Texnologiyalar to'plami
- **Backend**: Node.js 20, TypeScript, Express, Drizzle ORM, PostgreSQL
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack React Query
- **Valyuta**: UZS (so'm) butun sonlarda (integer) saqlanadi
- **Autentifikatsiya**: Telefon raqam va parol orqali (JWT asosida)

---

## O'rnatish va ishga tushirish

### 1. Muhit o'zgaruvchilari (`backend/.env`)

`backend/.env` faylida quyidagi parametrlarni sozlang:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/english_house?sslmode=disable
JWT_SECRET=change_me_to_a_long_random_string_min_32_chars
ADMIN_PHONE=+998900000001
ADMIN_PASSWORD=changeme123
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 2. Ma'lumotlar bazasi migratsiyasi va Seed qilish

```bash
cd backend
npm install
npm run db:migrate   # Drizzle jadvallarini yaratish
npm run seed         # Rollar va birinchi SuperAdminni yaratish
```

Boshlang'ich SuperAdmin ma'lumotlari:
- **Telefon**: `+998900000001`
- **Parol**: `changeme123`

### 3. Serverlarni ishga tushirish

**Backend serveri:**
```bash
cd backend
npm run dev
# http://localhost:3001 da ishga tushadi
```

**Frontend ilovasi:**
```bash
cd frontend
npm run dev
# http://localhost:5173 da ishga tushadi
```

---

## Rollar iyerarxiyasi
- **SuperAdmin**: Maktablar (S23 kabi kodlar bilan), direktorlar, komissiya qoidalari va to'liq audit monitoringi.
- **Direktor**: O'z maktabining o'qituvchilari, o'quvchilar ko'rsatkichlari va hisoblangan komissiyalari.
- **O'qituvchi**: O'z o'quvchilarini ro'yxatdan o'tkazish va o'z komissiyalari holati.
- **Manager / Admin**: O'quvchilarga qo'ng'iroq holatini (`WAITING`, `ACCEPTED`, `REJECTED`) yangilash, oylik to'lovlarni qayd qilish va komissiyalarni tasdiqlash (`mark-paid`).

---

## Hujjatlar
- [Ma'lumotlar bazasi strukturasi](file:///Users/macos/Desktop/HouseProject/docs/db-schema.md)
- [REST API so'rovlar qo'llanmasi](file:///Users/macos/Desktop/HouseProject/docs/api.md)
- [Frontend dizayn tizimi](file:///Users/macos/Desktop/HouseProject/frontend/DESIGN.md)
