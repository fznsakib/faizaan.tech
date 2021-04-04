import React from "react";
import { Link } from "gatsby";

import navbarStyles from "./navbar.module.scss";

export default function Navbar(props) {
  function NavbarLink(name, to) {
    return (
      <li>
        <Link
          className={navbarStyles.navItem}
          activeClassName={navbarStyles.activeNavItem}
          to={to}
        >
          {name}
        </Link>
      </li>
    );
  }

  return (
    <nav className={navbarStyles.nav}>
      <ul className={navbarStyles.navList}>
        {NavbarLink("home", "/")}
        {NavbarLink("about me", "/about")}
        {NavbarLink("projects", "/projects")}
        {NavbarLink("blog", "/blog")}
      </ul>
    </nav>
  );
}
