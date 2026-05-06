import { createContext, useContext } from 'react';

export const SidebarContext = createContext({ toggle: () => {} });
export const useSidebar = () => useContext(SidebarContext);
