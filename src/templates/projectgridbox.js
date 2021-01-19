import React from "react";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import projectGridBoxStyles from "./projectgridbox.module.scss";

export default function ProjectGridBox(props) {
  return (
    <div className={projectGridBoxStyles.box}>
      <img className={projectGridBoxStyles.image} src={props.image} alt={props.name} />
      <div className={projectGridBoxStyles.infoContainer}>
        <div className={projectGridBoxStyles.name}>{props.name}</div>
        <div className={projectGridBoxStyles.tags}>{props.tags}</div>
        <div className={projectGridBoxStyles.links}>
          <OutboundLink
            href={props.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <FontAwesomeIcon icon={faGithub} size="2x" aria-hidden="true" />
          </OutboundLink>
        </div>
      </div>
    </div>
  );
}
