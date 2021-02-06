import React from "react";
import { OutboundLink } from "gatsby-plugin-google-analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

import workProjectGridBoxStyles from "./workprojectgridbox.module.scss";

export default function WorkProjectGridBox(props) {
  console.log(props.startDate)

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

  return (
    <div className={workProjectGridBoxStyles.box}>
      <div className={workProjectGridBoxStyles.leftCard}>
        <img
          className={workProjectGridBoxStyles.image}
          src={props.image}
          alt={props.company}
        />
        <div className={workProjectGridBoxStyles.name}>{props.name}</div>
        <div className={workProjectGridBoxStyles.date}>{startDate} - {endDate}</div>
      </div>
    </div>
  );
}
