import { useStaticQuery, graphql } from "gatsby";

export default function WorkProjects() {
  const info = useStaticQuery(graphql`
    query {
      allContentfulWorkProject(sort: { fields: endDate, order: DESC }) {
        edges {
          node {
            name
            company
            position
            startDate
            endDate
            tags
            github
            website
            description {
              json
            }
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

  return info.allContentfulWorkProject.edges;
}
