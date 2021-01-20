import React from "react";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import personalProjectGridBoxStyles from "./personalprojectgridbox.module.scss";

export default function PersonalProjectGridBox(props) {
  return (
    <div className={personalProjectGridBoxStyles.box}>
      <img className={personalProjectGridBoxStyles.image} src={props.image} alt={props.name} />
      <div className={personalProjectGridBoxStyles.infoContainer}>
        <div className={personalProjectGridBoxStyles.name}>{props.name}</div>
        <div className={personalProjectGridBoxStyles.tags}>{props.tags}</div>
        <div className={personalProjectGridBoxStyles.links}>
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
