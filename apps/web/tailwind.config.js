import defaultTheme from "tailwindcss/defaultTheme";

/** InfraSure ERP design tokens — see README "Design system".
 *  Primary #1E3A8A (trust) · Success #10B981 · Warning #F59E0B ·
 *  Danger #DC2626 · Neutral #6B7280 · Surface #F3F4F6 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A8A",
          dark: "#16296B",
          light: "#3552B4",
          soft: "#E8EDFB",
        },
        success: { DEFAULT: "#10B981", soft: "#D1FAE5" },
        warning: { DEFAULT: "#F59E0B", soft: "#FEF3C7" },
        danger: { DEFAULT: "#DC2626", soft: "#FEE2E2" },
        neutral: { DEFAULT: "#6B7280" },
        surface: "#F3F4F6",
      },
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
