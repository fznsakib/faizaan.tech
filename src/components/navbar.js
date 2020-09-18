import React from "react";
import { Link } from "gatsby";

import navbarStyles from "./navbar.module.scss";

export default function Header(props) {
  return (
    <nav className={navbarStyles.nav}>
      <ul className={navbarStyles.navList}>
        <li>
          <Link
            className={navbarStyles.navItem}
            activeClassName={navbarStyles.activeNavItem}
            to="/"
          >
            {" "}
            home{" "}
          </Link>
        </li>
        <li>
          <Link
            className={navbarStyles.navItem}
            activeClassName={navbarStyles.activeNavItem}
            to="/about/"
          >
            {" "}
            about me{" "}
          </Link>
        </li>
        <li>
          <Link
            className={navbarStyles.navItem}
            activeClassName={navbarStyles.activeNavItem}
            to="/projects/"
          >
            {" "}
            projects{" "}
          </Link>
        </li>
        <li>
          <Link
            className={navbarStyles.navItem}
            activeClassName={navbarStyles.activeNavItem}
            to="/music/"
          >
            {" "}
            music{" "}
          </Link>
        </li>
        <li>
          <Link
            className={navbarStyles.navItem}
            activeClassName={navbarStyles.activeNavItem}
            to="/blog/"
          >
            {" "}
            blog{" "}
          </Link>
        </li>
        <li>
          <div className={navbarStyles.underConstructionNotice}>
            *website under construction
          </div>
        </li>
      </ul>
    </nav>
  );
}
