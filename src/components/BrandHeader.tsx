import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="group flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
          <img
            src={logo}
            alt="Pinseeker logo"
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold leading-tight tracking-tight text-foreground">
                Pinseeker
              </h1>
            </div>
            <p className="text-[11px] italic text-muted-foreground">
              "Snap the card. Chase the pin."
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 px-4 pb-2 text-xs">
        <NavLink to="/">Rounds</NavLink>
        <NavLink to="/stats">Scoring Stats</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
    </header>
  );
}

function NavLink({ to, children }: { to: "/" | "/stats" | "/profile"; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
      activeProps={{ className: "active" }}
    >
      {children}
    </Link>
  );
}
