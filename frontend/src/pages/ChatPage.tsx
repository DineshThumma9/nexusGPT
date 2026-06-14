import { useState } from "react";
import { FiX } from "react-icons/fi";
import Sidebar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import { Sheet, SheetContent, SheetClose } from "../components/ui/sheet";

const ChatPage = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  return (
    <div className="h-screen w-screen bg-background overflow-hidden p-0 m-0 relative">
      <div
        className={`grid h-screen w-screen bg-background transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden gap-0 
        ${isSidebarCollapsed ? "md:grid-cols-[80px_1fr]" : "md:grid-cols-[280px_1fr]"}
        grid-cols-1`}
      >
        {/* Desktop Sidebar */}
        <div className="hidden md:block overflow-hidden">
          <Sidebar onCollapse={setIsSidebarCollapsed} />
        </div>

        {/* Mobile Sidebar — Shadcn Sheet */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="p-0 bg-background max-w-[260px] border-r-0 flex flex-col"
          >
            <div className="flex justify-end p-2 shrink-0">
              <SheetClose className="p-1 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                <FiX className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
            <div className="flex-1 overflow-hidden">
              <Sidebar onCollapse={() => {}} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Chat Area */}
        <div className="overflow-hidden relative">
          <ChatArea onOpenSidebar={onOpen} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
