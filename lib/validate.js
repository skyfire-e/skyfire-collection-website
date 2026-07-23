const { z } = require('zod');

const booleanString = z.preprocess(
  v => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return v;
  },
  z.boolean()
);

const subcategorySchema = z.lazy(() =>
  z.union([
    z.object({ id: z.string().min(1), label: z.string().min(1) }),
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      type: z.literal('group'),
      subcategories: z.array(subcategorySchema).min(1)
    })
  ])
);

const sectionSchema = z.object({
  label: z.string().min(1),
  subcategories: z.array(subcategorySchema).default([])
});

const categoriesSchema = z.record(z.string().min(1), sectionSchema);

const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO 4217 currency code');

const settingsSchema = z.object({
  siteName: z.string().optional(),
  defaultImage: z.string().optional(),
  showSpreadsheet: z.boolean().optional(),
  showPublicSpreadsheet: z.boolean().optional(),
  showMiniaturesColumns: z.record(z.string(), z.boolean()).optional(),
  currencies: z.record(z.string(), currencyCode).optional()
}).passthrough();

const itemInputSchema = z.object({
  title: z.string().min(1, 'Title is required and must be non-empty'),
  section: z.string().min(1, 'Section is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.coerce.number().nonnegative('Price must be non-negative').optional().default(0),
  author: z.string().optional(),
  recaster: z.string().optional(),
  combatPoints: z.string().optional(),
  status: z.string().optional()
});

const itemInputPartialSchema = itemInputSchema.partial();

module.exports = {
  settingsSchema,
  categoriesSchema,
  itemInputSchema,
  itemInputPartialSchema,
  subcategorySchema,
  booleanString
};
