import { useState } from "react";
import { MessageCircle, X, MessageSquare, Users } from "lucide-react";

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Expanded menu */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Join Community */}
          <a
            href="https://chat.whatsapp.com/D5t3NNEwvtvJ8ZXNfNxQla"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg transition-colors whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Join Community</span>
          </a>

          {/* Contact Admin */}
          <a
            href="https://wa.me/233249083825"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg transition-colors whitespace-nowrap"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">Contact Admin</span>
          </a>
        </div>
      )}

      {/* Main floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg transition-all hover:scale-110 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
