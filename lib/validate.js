const { z } = require('zod');

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 currency code');

const settingsSchema = z.object({
  siteName: z.string().optional(),
  defaultImage: z.string().optional(),
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
  price: z.coerce.number().nonnegative('Price must be non-negative').nullable().optional(),
  author: z.string().max(100, 'Author max 100 chars').trim().optional(),
  recaster: z.string().max(100, 'Recaster max 100 chars').trim().optional(),
  combatPoints: z.string().max(20, 'Combat Points max 20 chars').trim().optional(),
  status: z.string().max(50, 'Status max 50 chars').trim().optional()
});

const itemInputPartialSchema = itemInputSchema.partial();

const categoryInputSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100, 'Label max 100 chars'),
  id: z.string().max(50, 'ID max 50 chars').trim().optional().refine(
    val => !val || !['__proto__', 'constructor', 'prototype'].includes(val),
    'Invalid category ID'
  ),
  section: z.string().max(50, 'Section max 50 chars').trim().optional(),
  parentId: z.string().max(50, 'Parent ID max 50 chars').trim().optional(),
  isGroup: z.boolean().optional()
});

module.exports = {
  settingsSchema,
  itemInputSchema,
  itemInputPartialSchema,
  categoryInputSchema
};
