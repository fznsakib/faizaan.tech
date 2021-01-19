import { useStaticQuery, graphql } from "gatsby";

export default function Projects() {
  const info = useStaticQuery(graphql`
    query {
      allContentfulProject(sort: { fields: date, order: DESC }) {
        edges {
          node {
            name
            type
            tags
            github
            website
            image {
              file {
                url
              }
            }
          }
        }
      }
    }
  `);

  return info.allContentfulProject.edges;
}
