
import { BasketballIcon } from "../icons/basketball";

export const LoadingModal = ({ text = "Cargando..." }: { text?: string }) => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <BasketballIcon className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xl font-semibold text-primary">{text}</span>
        </div>
    </div>
);
