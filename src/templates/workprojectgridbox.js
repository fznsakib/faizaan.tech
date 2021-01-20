import React from "react";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import workProjectGridBoxStyles from "./workprojectgridbox.module.scss";

export default function WorkProjectGridBox(props) {
  return (
    <div className={workProjectGridBoxStyles.box}>
      <img
        className={workProjectGridBoxStyles.image}
        src={props.image}
        alt={props.name}
      />
      <div className={workProjectGridBoxStyles.infoContainer}>
        <div className={workProjectGridBoxStyles.name}>{props.name}</div>
        <div className={workProjectGridBoxStyles.tags}>{props.tags}</div>
        <div className={workProjectGridBoxStyles.links}>
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
