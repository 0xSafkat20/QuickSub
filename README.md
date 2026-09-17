# QuickSub

The current release includes a working `/admin` dashboard, Supabase-backed product/package management, customer checkout, manual payment verification, private order tracking, support inbox, offers and Gemini support. Start with [ADMIN-SETUP.md](ADMIN-SETUP.md) for installation and activation. The overview below describes the original storefront.

## Short Description

**QuickSub** is a modern web-based platform for displaying and managing digital subscription services, gaming top-ups, music plans, streaming services, and productivity tools. The project is built as a professional landing page where users can explore available products, view prices, check delivery information, and contact support easily.

The main goal of QuickSub is to create a clean, fast, and trustworthy digital service website that can be used for online subscription-based products.

---

## Abstract

QuickSub is designed to solve the problem of scattered and unclear digital subscription services by presenting all available products in one simple and organized platform. The website focuses on user experience, fast navigation, responsive design, and clear product presentation.

The project uses a component-based frontend architecture, making it easy to update products, categories, reviews, FAQ content, and promotional sections. It is suitable for future expansion with payment systems, order management, customer login, admin dashboard, and database integration.

This project is mainly focused on frontend development, but it also includes the structure needed for future backend and database support.

---

## Languages and Tools Used

### Programming Languages

- **TypeScript**
- **JavaScript**
- **HTML**
- **CSS**

### Frameworks and Libraries

- **React.js** — For building the user interface
- **Vite** — For fast development and production build
- **Tailwind CSS** — For modern responsive styling
- **Framer Motion** — For smooth animations
- **Lucide React** — For clean and professional icons
- **Supabase Client** — For possible future backend/database integration

### Development Tools

- **Node.js**
- **npm**
- **ESLint**
- **Git**
- **GitHub**

---

## Main Features

- Responsive landing page design
- Modern hero section
- Product category section
- Product grid with digital service cards
- Streaming, gaming, music, and AI tool categories
- Customer review section
- FAQ section
- Trust and feature section
- Promotional banner
- Final call-to-action section
- Header and footer layout
- Chatbot/support component
- Clean and reusable component structure
- Ready for future backend integration

---

## Project Structure

```txt
QuickSub/
├── public/
├── src/
│   ├── components/
│   │   ├── chatbot/
│   │   ├── layout/
│   │   └── sections/
│   ├── data/
│   │   ├── categories.ts
│   │   ├── faq.ts
│   │   ├── products.ts
│   │   └── reviews.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## Important Project Files

### `src/App.tsx`

This is the main application file. It connects all the major page sections together.

### `src/components/sections/`

This folder contains the main landing page sections such as:

- Hero
- Product Grid
- Category Section
- Reviews
- FAQ
- Final CTA
- Promo Banner
- Trust Features

### `src/components/layout/`

This folder contains common layout components:

- Header
- Footer

### `src/components/chatbot/`

This folder contains the chatbot or support widget component.

### `src/data/`

This folder stores website data such as:

- Product information
- Category information
- FAQ content
- Customer reviews

This makes the website easier to update without changing the main UI code.

---

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/0xSafkat20/QuickSub.git
```

### 2. Go to the Project Folder

```bash
cd QuickSub
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Project

```bash
npm run dev
```

After running the command, open the local server link shown in the terminal.

Usually it will be:

```txt
http://localhost:5173
```

---

## Available Commands

```bash
npm run dev
```

Runs the project in development mode.

```bash
npm run build
```

Creates the final production build.

```bash
npm run preview
```

Previews the production build locally.

```bash
npm run lint
```

Checks the code using ESLint.

```bash
npm run typecheck
```

Checks TypeScript errors without generating output files.

---

## Product Data Management

All products are stored inside:

```txt
src/data/products.ts
```

To add or edit products, update this file.

Each product can include:

- Product name
- Category
- Short description
- Price
- Delivery time
- CTA button text
- Badges
- Banner image
- Availability status

---

## Customization Guide

### Change Website Text

Update the related section file inside:

```txt
src/components/sections/
```

### Change Products

Update:

```txt
src/data/products.ts
```

### Change FAQ

Update:

```txt
src/data/faq.ts
```

### Change Reviews

Update:

```txt
src/data/reviews.ts
```

### Change Styling

Most styling is handled using Tailwind CSS classes inside the React components.

Global styles can be updated from:

```txt
src/index.css
```

---

## Future Development Ideas

This project can be improved by adding:

- Online payment system
- Order tracking system
- Admin dashboard
- Customer login system
- Product search and filtering
- Backend database
- Supabase authentication
- Live chat support
- Order history
- SEO optimization
- Product detail pages
- Blog or announcement section

---

## Deployment

The project can be deployed on platforms like:

- Vercel
- Netlify
- Firebase Hosting
- GitHub Pages

Before deployment, run:

```bash
npm run build
```

The final production files will be generated inside:

```txt
dist/
```

---

## Conclusion

QuickSub is a clean, responsive, and scalable frontend project for a digital subscription service website. It is easy to customize, simple to maintain, and ready for future improvements such as payments, database integration, and order management.

