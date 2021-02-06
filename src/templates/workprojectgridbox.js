import React from "react";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";

import workProjectGridBoxStyles from "./workprojectgridbox.module.scss";

export default function WorkProjectGridBox(props) {

  function convertDateToString (date) {
    return new Date(date).toLocaleDateString(
      'en-gb',
      {
        year: 'numeric',
        month: 'long'
      }
    )
  }

  const startDate = convertDateToString(props.startDate)
  const endDate = convertDateToString(props.endDate)

  const githubExists = (props.github !== 'None');
  const websiteExists = (props.website !== 'None');

  return (
    <div className={workProjectGridBoxStyles.box}>
      <div className={workProjectGridBoxStyles.leftCard}>
        <div className={workProjectGridBoxStyles.header}>
          <div className={workProjectGridBoxStyles.position}>{props.position}</div>
          <div className={workProjectGridBoxStyles.at}>@</div>
          <div className={workProjectGridBoxStyles.company}>{props.company}</div>
        </div>
        <div className={workProjectGridBoxStyles.description}>
          {documentToReactComponents(props.description.json)}
        </div>
        <div className={workProjectGridBoxStyles.tagsContainer}>
          <ul className={workProjectGridBoxStyles.tags}>
            {props.tags.map((tag, index) => {
              return <li className={workProjectGridBoxStyles.tag}>{tag}</li>
            })}
          </ul>
        </div>
      </div>
      <div className={workProjectGridBoxStyles.rightCard}>
        <img
          className={workProjectGridBoxStyles.image}
          src={props.image}
          alt={props.company}
        />
        <div className={workProjectGridBoxStyles.name}>{props.name}</div>
        <div className={workProjectGridBoxStyles.date}>{startDate} - {endDate}</div>
        <div className={workProjectGridBoxStyles.linksContainer}>
          {githubExists &&
            <OutboundLink
              href={props.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className={workProjectGridBoxStyles.github}
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
              className={workProjectGridBoxStyles.website}
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} size="2x" aria-hidden="true" />
            </OutboundLink>
          }
        </div>
      </div>
    </div>
  );
}
