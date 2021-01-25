import React from "react";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import personalProjectGridBoxStyles from "./personalprojectgridbox.module.scss";

export default function PersonalProjectGridBox(props) {
  const githubExists = (props.github !== 'None');
  const websiteExists = (props.website !== 'None');

  return (
    <div className={personalProjectGridBoxStyles.box}>
      <div className={personalProjectGridBoxStyles.imageContainer}>
        <img
          className={personalProjectGridBoxStyles.image}
          src={props.image}
          alt={props.name}
        />
      </div>
      <div className={personalProjectGridBoxStyles.infoContainer}>
        <div className={personalProjectGridBoxStyles.name}>{props.name}</div>
        <ul className={personalProjectGridBoxStyles.tags}>
          {props.tags.map((tag, index) => {
            return <li className={personalProjectGridBoxStyles.tag}>{tag}</li>
          })}
        </ul>
        <div className={personalProjectGridBoxStyles.links}>
          {githubExists &&
            <OutboundLink
              href={props.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className={personalProjectGridBoxStyles.github}
            >
              <FontAwesomeIcon icon={faGithub} size="2x" aria-hidden="true" />
            </OutboundLink>
          }
          {websiteExists &&
            <OutboundLink
              href={props.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className={personalProjectGridBoxStyles.website}
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} size="2x" aria-hidden="true" />
            </OutboundLink>
          }
        </div>
      </div>
    </div>
  );
}
