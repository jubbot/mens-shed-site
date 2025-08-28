export const TYPE_TO_SEGMENT = {
  socialEvent: 'social-event',
  workshop: 'workshop',
  creative: 'creative-activity',
} as const;

export const SEGMENT_TO_TYPE: Record<string, keyof typeof TYPE_TO_SEGMENT> = {
  'social-event': 'socialEvent',
  'workshop': 'workshop',
  'creative-activity': 'creative',
};
