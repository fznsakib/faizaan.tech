import React from "react"

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faIdBadge, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faLinkedinIn, faGithub, faSoundcloud } from '@fortawesome/free-brands-svg-icons'

import iconBarStyles from "./iconbar.module.scss"


export default function IconBar(props) {
    return (
        <ul className={iconBarStyles.iconBar}>
            <li>
                <a href="https://www.github.com/fznsakib" target="_blank" rel="noopener noreferrer" className={iconBarStyles.resumeIcon}>
                    <FontAwesomeIcon icon={faIdBadge} size='2x' fixedWidth/>
                </a>
            </li>
            <li>
                <a href="mailto:fznsakib@gmail.com" target="_blank" rel="noopener noreferrer" className={iconBarStyles.emailIcon}>
                    <FontAwesomeIcon icon={faEnvelope} size='2x' fixedWidth/>
                </a>
            </li>
            <li>
                <a href="https://www.linkedin.com/in/faizaan-sakib" target="_blank" rel="noopener noreferrer" className={iconBarStyles.linkedinIcon}>
                    <FontAwesomeIcon icon={faLinkedinIn} size='2x' fixedWidth/>
                </a>
            </li>
            <li>
                <a href="https://www.github.com/fznsakib" target="_blank" rel="noopener noreferrer" className={iconBarStyles.githubIcon}>
                    <FontAwesomeIcon icon={faGithub} size='2x' fixedWidth/>
                </a>
            </li>
            <li>
                <a href="https://soundcloud.com/etaki" target="_blank" rel="noopener noreferrer" className={iconBarStyles.soundcloudIcon}>
                    <FontAwesomeIcon icon={faSoundcloud} size='2x' fixedWidth/>
                </a>
            </li>
        </ul>
    )
  }