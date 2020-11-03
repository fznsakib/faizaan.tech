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
          <a
            href={this.props.resume_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faIdBadge} size="2x" />
          </a>
        </li>
        <li className={iconBarStyles.emailIcon}>
          <OutboundLink
            href="mailto:fznsakib@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faEnvelope} size="2x" />
          </OutboundLink>
        </li>
        <li className={iconBarStyles.linkedinIcon}>
          <OutboundLink
            href="https://www.linkedin.com/in/faizaan-sakib"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faLinkedinIn} size="2x" />
          </OutboundLink>
        </li>
        <li className={iconBarStyles.githubIcon}>
          <OutboundLink
            href="https://www.github.com/fznsakib"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faGithub} size="2x" />
          </OutboundLink>
        </li>
        <li className={iconBarStyles.soundcloudIcon}>
          <OutboundLink
            href="https://soundcloud.com/etaki"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon={faSoundcloud} size="2x" />
          </OutboundLink>
        </li>
      </ul>
    );
  }
}

export default IconBar;
