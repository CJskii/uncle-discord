import { Locale } from 'discord.js';
import { describe, expect, it } from 'vitest';

import {
    countXdOccurrences,
    formatXdNumber,
    formatXdPercentage,
} from '../../src/utils/xd-utils.js';

describe('countXdOccurrences', () => {
    it.each([
        ['xd', 1],
        ['XD', 1],
        ['xD', 1],
        ['Xd', 1],
        ['xDdDd', 1],
        ['xd xd xDDD', 3],
        ['XDDDDDD', 1],
        ['(XD) XD! xd...', 3],
        ['„XDDD” i ale XD, dobre', 2],
        ['XD\nxd\nXDD', 3],
        ['examplexdword', 0],
        ['indexdata', 0],
        ['some_xd_identifier', 0],
        ['https://example.com/examplexdword', 0],
        ['https://example.com/xd', 0],
        ['www.example.pl/XDDD?foo=1', 0],
        ['<:xd:123456789012345678>', 0],
        ['<a:XDDD:123456789012345678>', 0],
        ['**XD** oraz `xd`', 2],
        ['<@123456789012345678> XD', 1],
        ['', 0],
        ['żXD', 0],
        ['XDż', 0],
        ['XD 😂', 1],
    ])('counts %j as %i', (content: string, expected: number) => {
        expect(countXdOccurrences(content)).toBe(expected);
    });
});

describe('XD formatting', () => {
    it('formats Polish and English numbers and percentage ratios', () => {
        expect(formatXdNumber(12_345, Locale.Polish).replace(/\u00a0/g, ' ')).toBe('12 345');
        expect(formatXdNumber(12_345, Locale.EnglishGB)).toBe('12,345');
        expect(formatXdPercentage(0.10625, Locale.Polish)).toBe('10,63%');
        expect(formatXdPercentage(0.10625, Locale.EnglishGB)).toBe('10.63%');
        expect(formatXdPercentage(0, Locale.Polish)).toBe('0,00%');
        expect(formatXdPercentage(0, Locale.EnglishGB)).toBe('0.00%');
    });
});
