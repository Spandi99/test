"use client";

import { useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { BsListTask, BsCalendar } from "react-icons/bs";
import {
  HiOutlineChartBar,
  HiOutlineLightBulb,
  HiOutlineMenu,
  HiOutlineSearch,
  HiOutlineX,
} from "react-icons/hi";
import { RiKeyboardLine } from "react-icons/ri";

import { cn } from "@/lib/utils";

import { useShortcutsStore } from "@/store/shortcuts";

import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface AppNavProps {
  className?: string;
}

export function AppNav({ className }: AppNavProps) {
  const pathname = usePathname();
  const { setOpen: setShortcutsOpen } = useShortcutsStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: "/calendar", label: "Calendar", icon: BsCalendar },
    { href: "/tasks", label: "Tasks", icon: BsListTask },
    { href: "/focus", label: "Focus", icon: HiOutlineLightBulb },
    { href: "/stats", label: "Stats", icon: HiOutlineChartBar },
  ];

  const openCommandPalette = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);

  return (
    <nav
      className={cn(
        "relative z-30 flex flex-col bg-background/95 backdrop-blur",
        className
      )}
    >
      <div className="hidden h-16 items-center border-b border-border px-4 md:flex">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/calendar"
              className={cn(
                "mr-6 flex items-center",
                pathname === "/calendar"
                  ? "text-primary"
                  : "text-foreground hover:text-primary"
              )}
            >
              <Image
                src="/logo.svg"
                alt="Calendar Logo"
                width={28}
                height={28}
                className="mr-2"
              />
            </Link>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCommandPalette}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="Search or run a command (⌘K)"
            >
              <HiOutlineSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-1 hidden rounded bg-muted px-1 py-0.5 text-xs sm:inline">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            <button
              onClick={() => setShortcutsOpen(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title="View Keyboard Shortcuts (Press ?)"
            >
              <RiKeyboardLine className="h-4 w-4" />
              <span className="hidden sm:inline">Shortcuts</span>
              <kbd className="ml-1 hidden rounded bg-muted px-1 py-0.5 text-xs sm:inline">
                ?
              </kbd>
            </button>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="flex h-16 items-center justify-between border-b border-border px-4 md:hidden">
        <Link href="/calendar" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Calendar Logo" width={28} height={28} />
          <span className="text-base font-semibold">Flowstate</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={openCommandPalette}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Suche öffnen"
          >
            <HiOutlineSearch className="h-5 w-5" />
          </button>
          <ThemeToggle />
          <button
            onClick={toggleMobileMenu}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Menü öffnen"
          >
            {mobileMenuOpen ? (
              <HiOutlineX className="h-6 w-6" />
            ) : (
              <HiOutlineMenu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-b border-border bg-background/95 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setShortcutsOpen(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <RiKeyboardLine className="h-4 w-4" />
              Shortcuts
            </button>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground">Account</span>
              <UserMenu />
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur md:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
