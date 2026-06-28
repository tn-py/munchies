import { defineField } from "sanity";

export default defineField({
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "collection",
      title: "Collection",
      description: "When set, products are pulled dynamically from this collection (overrides the Products list below).",
      type: "reference",
      to: [{ type: "collection" }],
    },
    {
      name: "products",
      of: [{ to: [{ type: "product" }], type: "reference" }],
      title: "Products",
      description: "Used only when no Collection is selected.",
      type: "array",
    },
    {
      name: "cta",
      title: "CTA",
      type: "cta",
    },
  ],
  name: "section.featuredProducts",
  preview: {
    prepare: ({ title }) => ({
      subtitle: "Featured products section",
      title,
    }),
    select: {
      title: "title",
    },
  },
  title: "Featured products section",
  type: "object",
});
