import React from "react"
import { graphql, useStaticQuery } from "gatsby"

export default function Footer(props) {

  const data = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          author
        }
      }
    }
  `)

  return (
    <footer>
      Created by {data.site.siteMetadata.author}, 2020 ©
    </footer>
  )
}