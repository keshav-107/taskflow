import { useSidebar } from './SidebarContext';

/** Renders a hamburger icon button inside any page-header. Hidden on desktop via CSS. */
export default function HamburgerBtn() {
  const { toggle } = useSidebar();
  return (
    <button
      className="hamburger"
      onClick={toggle}
      aria-label="Open menu"
      style={{ flexShrink: 0 }}
    >
      <span /><span /><span />
    </button>
  );
}
