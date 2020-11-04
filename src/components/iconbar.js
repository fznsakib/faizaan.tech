import React, { Component } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import {
  faLinkedinIn,
  faGithub,
  faSoundcloud,
} from "@fortawesome/free-brands-svg-icons";
import { OutboundLink } from "gatsby-plugin-google-analytics"

import iconBarStyles from "./iconbar.module.scss";

class IconBar extends Component {
  constructor(props) {
    super();
    this.state = {
      animate: true,
    };
  }

  render() {
    return (
      <ul
        className={iconBarStyles.iconBar}
      >
        <li className={iconBarStyles.resumeIcon}>
          <OutboundLink
            href={this.props.resume_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CV"
          >
            <FontAwesomeIcon icon={faIdBadge} size="2x" aria-hidden="true"/>
          </OutboundLink>
        </li>
        <li className={iconBarStyles.emailIcon}>
          <OutboundLink
            href="mailto:fznsakib@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Email"
          >
            <FontAwesomeIcon icon={faEnvelope} size="2x" aria-hidden="true"/>
          </OutboundLink>
        </li>
        <li className={iconBarStyles.linkedinIcon}>
          <OutboundLink
            href="https://www.linkedin.com/in/faizaan-sakib"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <FontAwesomeIcon icon={faLinkedinIn} size="2x" aria-hidden="true"/>
          </OutboundLink>
        </li>
        <li className={iconBarStyles.githubIcon}>
          <OutboundLink
            href="https://www.github.com/fznsakib"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <FontAwesomeIcon icon={faGithub} size="2x" aria-hidden="true"/>
          </OutboundLink>
        </li>
        <li className={iconBarStyles.soundcloudIcon}>
          <OutboundLink
            href="https://soundcloud.com/etaki"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SoundCloud"
          >
            <FontAwesomeIcon icon={faSoundcloud} size="2x" aria-hidden="true"/>
          </OutboundLink>
        </li>
      </ul>
    );
  }
}

export default IconBar;
