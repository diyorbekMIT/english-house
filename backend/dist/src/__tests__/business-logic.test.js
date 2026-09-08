"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const students_js_1 = require("../routes/students.js");
(0, vitest_1.describe)('Phone Normalization', () => {
    (0, vitest_1.it)('normalizes 9-digit Uzbek phone number', () => {
        (0, vitest_1.expect)((0, students_js_1.normalizePhone)('901234567')).toBe('+998901234567');
    });
    (0, vitest_1.it)('normalizes 12-digit number starting with 998', () => {
        (0, vitest_1.expect)((0, students_js_1.normalizePhone)('998901234567')).toBe('+998901234567');
    });
    (0, vitest_1.it)('handles spaces, dashes, and parentheses', () => {
        (0, vitest_1.expect)((0, students_js_1.normalizePhone)('+998 (90) 123-45-67')).toBe('+998901234567');
        (0, vitest_1.expect)((0, students_js_1.normalizePhone)('90 123 45 67')).toBe('+998901234567');
    });
});
(0, vitest_1.describe)('Commission Calculation Math', () => {
    // teacherMonthlyPercent and directorMonthlyPercent are stored in basis points (1000 = 10.00%, 500 = 5.00%)
    const calculateCommission = (amountUzs, percentBasisPoints) => {
        return Math.floor((amountUzs * percentBasisPoints) / 10000);
    };
    (0, vitest_1.it)('calculates exact integer UZS amounts without floating point errors', () => {
        // 500,000 UZS with 10% (1000 bp)
        (0, vitest_1.expect)(calculateCommission(500000, 1000)).toBe(50000);
        // 500,000 UZS with 5% (500 bp)
        (0, vitest_1.expect)(calculateCommission(500000, 500)).toBe(25000);
        // 333,333 UZS with 7.5% (750 bp)
        // 333333 * 750 / 10000 = 24999.975 -> Math.floor -> 24999
        (0, vitest_1.expect)(calculateCommission(333333, 750)).toBe(24999);
        (0, vitest_1.expect)(Number.isInteger(calculateCommission(333333, 750))).toBe(true);
    });
    (0, vitest_1.it)('returns 0 when amount or rate is zero', () => {
        (0, vitest_1.expect)(calculateCommission(0, 1000)).toBe(0);
        (0, vitest_1.expect)(calculateCommission(500000, 0)).toBe(0);
    });
});
