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
  title: z.string().min(1, 'Title is required and must be non-empty'),
  section: z.string().min(1, 'Section is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().nonnegative('Price must be non-negative').nullable().optional(),
  author: z.string().optional(),
  recaster: z.string().optional(),
  combatPoints: z.string().optional(),
  status: z.string().optional()
});

const itemInputPartialSchema = itemInputSchema.partial();

module.exports = {
  settingsSchema,
  itemInputSchema,
  itemInputPartialSchema
};
