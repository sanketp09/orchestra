// Framer Motion presets (stagger, count-up, ease)

export class AnimationPresets {
  static fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  static slideInRight = {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  };
}

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
