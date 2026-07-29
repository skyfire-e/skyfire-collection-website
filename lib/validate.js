const { z } = require('zod');

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 currency code');

const settingsSchema = z.object({
  siteName: z.string().max(200, 'Site name max 200 chars').optional(),
  // null resets the setting back to its default (removes the stored key)
  defaultImage: z.string().max(500, 'Default image path max 500 chars')
    .regex(/^\/(uploads|images)\//, 'Default image must be a local /uploads/ or /images/ path')
    .nullable().optional(),
  defaultTheme: z.enum(['dark', 'light']).optional(),
  showSpreadsheet: z.boolean().optional(),
  showPublicSpreadsheet: z.boolean().optional(),
  showMiniaturesColumns: z.record(z.string(), z.boolean()).optional(),
  sectionsWithExtraFields: z.array(z.string()).optional(),
  currencies: z.record(z.string(), currencyCode).optional()
}).strict();

const itemInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required and must be non-empty').max(200, 'Title max 200 chars'),
  section: z.string().trim().min(1, 'Section is required').max(50, 'Section max 50 chars'),
  category: z.string().trim().min(1, 'Category is required').max(50, 'Category max 50 chars'),
  price: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    },
    z.number().nonnegative('Price must be non-negative').nullable()
  ).optional(),
  author: z.string().max(100, 'Author max 100 chars').trim().optional(),
  recaster: z.string().max(100, 'Recaster max 100 chars').trim().optional(),
  combatPoints: z.string().max(20, 'Combat Points max 20 chars').trim().optional(),
  status: z.string().max(50, 'Status max 50 chars').trim().optional()
});

const categoryInputSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100, 'Label max 100 chars'),
  // Same charset the reorder schemas already require; keeps IDs safe for URLs and sitemap XML
  id: z.string().trim().max(50, 'ID max 50 chars')
    .regex(/^[A-Za-z0-9-]+$/, 'ID may only contain letters, digits and hyphens')
    .refine(
      val => !['__proto__', 'constructor', 'prototype'].includes(val),
      'Invalid category ID'
    )
    .optional(),
  section: z.string().max(50, 'Section max 50 chars').trim().optional(),
  parentId: z.string().max(50, 'Parent ID max 50 chars').trim().optional(),
  isGroup: z.boolean().optional()
}).superRefine((value, context) => {
  const hasRealParent = value.parentId && value.parentId !== '__new_section__';
  if (hasRealParent && value.isGroup === true) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isGroup'],
      message: 'A group cannot be created inside another group'
    });
  }
});

const reorderInputSchema = z.object({
  section: z.string().trim().min(1, 'Section is required').max(50, 'Section max 50 chars'),
  category: z.string().trim().min(1, 'Category is required').max(50, 'Category max 50 chars'),
  // Item IDs are UUIDs for new items but legacy timestamp strings (e.g. "1784583148282") for old ones.
  // Existence in DB is verified by the route — format check only guards against garbage.
  items: z.array(
    z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/, 'Invalid item ID format'),
    'Invalid item ID format'
  ).min(1, 'Items array must not be empty')
});

const categoryReorderSchema = z.object({
  section: z.string().trim().min(1, 'Section is required').max(50, 'Section max 50 chars'),
  parentId: z.string().trim().min(1).max(50, 'Parent ID max 50 chars')
    .regex(/^[A-Za-z0-9-]+$/, 'Invalid parent ID format').optional(),
  items: z.array(
    z.string().min(1).max(50).regex(/^[A-Za-z0-9-]+$/, 'Invalid category ID format'),
    'Invalid category ID format'
  ).min(1, 'Items array must not be empty')
});

module.exports = {
  settingsSchema,
  itemInputSchema,
  categoryInputSchema,
  reorderInputSchema,
  categoryReorderSchema
};
