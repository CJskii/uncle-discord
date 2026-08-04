import { Locale } from 'discord.js';

const DISCORD_CUSTOM_EMOJI = /<a?:[\p{L}\p{N}_]+:\d+>/giu;
const URL = /(?:https?:\/\/|www\.)[^\s<>]+/giu;
const XD_EXPRESSION = /(?<![\p{L}\p{N}_])xd+(?![\p{L}\p{N}_])/giu;

export function countXdOccurrences(content: string): number {
    let countableContent = content.replace(URL, ' ').replace(DISCORD_CUSTOM_EMOJI, ' ');
    return [...countableContent.matchAll(XD_EXPRESSION)].length;
}

export function formatXdNumber(value: number, locale: Locale): string {
    return new Intl.NumberFormat(locale).format(value);
}

export function formatXdPercentage(ratio: number, locale: Locale): string {
    return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(ratio);
}
