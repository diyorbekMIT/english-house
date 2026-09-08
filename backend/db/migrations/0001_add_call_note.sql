-- Migration: add call_note to students
-- This field allows admins to record the reason for rejection or notes on waiting status.

ALTER TABLE students ADD COLUMN IF NOT EXISTS call_note text;
