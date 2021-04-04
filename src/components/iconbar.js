import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import {
  faLinkedinIn,
  faGithub,
  faSoundcloud,
} from "@fortawesome/free-brands-svg-icons";
import { OutboundLink } from "gatsby-plugin-google-analytics";

import { ResumeURL } from "../hooks/resumeurl";
import iconBarStyles from "./iconbar.module.scss";

export default function IconBar() {
  const resume_url = ResumeURL();

  function IconBarItem(href, icon, iconStyle) {
    return (
      <li className={iconStyle}>
        <OutboundLink
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="CV"
        >
          <FontAwesomeIcon icon={icon} size="2x" aria-hidden="true" />
        </OutboundLink>
      </li>
    );
  }

  return (
    <ul className={iconBarStyles.iconBar}>
      {IconBarItem(resume_url, faIdBadge, iconBarStyles.resumeIcon)}
      {IconBarItem(
        "mailto:fznsakib@gmail.com",
        faEnvelope,
        iconBarStyles.emailIcon
      )}
      {IconBarItem(
        "https://www.linkedin.com/in/faizaan-sakib",
        faLinkedinIn,
        iconBarStyles.linkedinIcon
      )}
      {IconBarItem(
        "https://www.github.com/fznsakib",
        faGithub,
        iconBarStyles.githubIcon
      )}
      {IconBarItem(
        "https://soundcloud.com/etaki",
        faSoundcloud,
        iconBarStyles.soundcloudIcon
      )}
    </ul>
  );
}
