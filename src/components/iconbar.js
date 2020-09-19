import React, { Component } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import {
  faLinkedinIn,
  faGithub,
  faSoundcloud,
} from "@fortawesome/free-brands-svg-icons";

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
        className={
          this.state.animate
            ? `${iconBarStyles.iconBarAnimation}`
            : `${iconBarStyles.iconBar}`
        }
      >
        <li>
          <a
            href={this.props.resume_url}
            target="_blank"
            rel="noopener noreferrer"
            className={iconBarStyles.resumeIcon}
          >
            <FontAwesomeIcon icon={faIdBadge} size="2x" fixedWidth />
          </a>
        </li>
        <li>
          <a
            href="mailto:fznsakib@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBarStyles.emailIcon}
          >
            <FontAwesomeIcon icon={faEnvelope} size="2x" fixedWidth />
          </a>
        </li>
        <li>
          <a
            href="https://www.linkedin.com/in/faizaan-sakib"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBarStyles.linkedinIcon}
          >
            <FontAwesomeIcon icon={faLinkedinIn} size="2x" fixedWidth />
          </a>
        </li>
        <li>
          <a
            href="https://www.github.com/fznsakib"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBarStyles.githubIcon}
          >
            <FontAwesomeIcon icon={faGithub} size="2x" fixedWidth />
          </a>
        </li>
        <li>
          <a
            href="https://soundcloud.com/etaki"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBarStyles.soundcloudIcon}
          >
            <FontAwesomeIcon icon={faSoundcloud} size="2x" fixedWidth />
          </a>
        </li>
      </ul>
    );
  }

  componentDidMount() {
    // Check for token
    if (window.sessionStorage.getItem("iconBarLoaded") === null) {
      this.setState({
        animate: true,
      });
      // Set token so that animation is not performed next time
      window.sessionStorage.setItem("iconBarLoaded", 1);
    } else {
      this.setState({
        animate: false,
      });
    }
  }
}

export default IconBar;
