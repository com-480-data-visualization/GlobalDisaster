# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| Mohammadamin Azarsa | 395085 |
| Timothée Coester | 341829 |
| Koorosh Sahafi | 289678 |
| Ella Neike | 345013 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

For our project, we chose the [EM-DAT dataset](https://www.emdat.be/), provided by the centre for research on the epidemiology of disasters (cred). em-dat is an open-access database for non-commercial use that tracks disasters worldwide, based on sources such as un agencies, ngos, research institutes, reinsurance companies, and press agencies. While the full database contains more than 27,000 disaster records, our work focuses only on natural disasters, which gives us a dataset of around 17,000 records.

We chose this dataset because it is large, well known, and contains useful variables for visualization, such as disaster type, country, year, deaths, affected people, and sometimes economic damage. From our first exploration, the dataset seems overall good quality, but some columns have many missing values, especially for older events and for variables like costs or coordinates. Because of that, some preprocessing will be needed, mainly cleaning missing values, formatting dates, and keeping the most complete variables.

EM-DAT also has some known biases that they explain in their official documentation [Specific Biases](https://doc.emdat.be/docs/known-issues-and-limitations/specific-biases/). Reported disaster frequency increases over time because of better reporting rather than actual increases, larger events are more likely to be recorded than smaller ones, and data quality can vary across regions and hazard types.

### Problematic

With this project, we want to show how recorded natural disasters are distributed across time and space, and how their effects can vary depending on the region and the type of disaster. Our main idea is to help people see the bigger picture: not only where disasters are reported, but also which ones seem to have the strongest human impact.

Our motivation comes from the fact that natural disasters are usually seen one by one in the news, while the global patterns are less visible. At the same time, we want to be careful not to over-interpret the data, since a higher number of recorded events does not always mean that disasters truly became more frequent, but can also reflect better reporting over time. Using this dataset, we want to build a visualization that makes these patterns easier to explore and understand while keeping these limits in mind. Our target audience is mainly the general public who want a simple and interactive way to learn more about natural disasters.

### Exploratory Data Analysis

Our first [exploratory analysis](exploration/data_exploration.ipynb) was mainly used to check the structure of the dataset and identify which variables are the most reliable for the project. After cleaning the column names and inspecting the table, we found that the dataset is overall well structured. We did not find duplicated rows or disaster IDs, which is a good sign for consistency. The main descriptive variables such as country, region, disaster type, and year, are generally complete enough for visualization.
<p align="center">
<img height="350" alt="image" src="https://github.com/user-attachments/assets/8e0be793-80c2-4408-a9c2-16bb69737416" />
</p>

The main issue we found is missing data. This is especially true for variables related to economic damage, coordinates, and some impact measures. This confirms our visualizations should rely mostly on variables : year, country, region, disaster type, total deaths, and total affected. More incomplete variables, especially financial ones, will need to be used more carefully.
<p align="center">
<img height="305" alt="image" src="https://github.com/user-attachments/assets/a35e3197-2f85-4d17-ba0b-9040168d249a" />
</p>

A first important pattern is the strong increase in recorded natural disasters over time, especially after the mid-20th century. However, this result should be interpreted carefully, as part of this increase may come from better reporting and monitoring. For this reason, our project focuses on recorded disasters rather than making direct claims about absolute trends.
<p align="center">
<img height="375" alt="image" src="https://github.com/user-attachments/assets/8035677b-1a91-47d9-88ce-1381ebc1f80b" />
</p>

The exploratory analysis also shows that disaster types are not evenly represented. Floods and storms are by far the most frequent, while earthquakes, droughts, and epidemics appear less often. This suggests that comparing not only the number of events but also how different disaster types contribute to human impact will be an important axis of the project.
<p align="center">
<img height="500" alt="newplot" src="https://github.com/user-attachments/assets/2c792276-f2be-45d1-aa80-523dd013ea7b" />
</p>

Finally, the spatial distribution is very uneven. Some countries like the United States, China, and India have many more recorded events, which can reflect reporting capacity and country size as much as real exposure. Overall, this analysis confirmed that the dataset is suitable for our project while highlighting the main limitations to keep in mind.

### Related work

This public dataset has already been studied several times with interesting insights. Here are a few works and their main conclusions:

##### **Natural disasters: a comprehensive study using EMDAT database 1995-2022**, by D.Tin, L. Cheng, D. Le, R. Hata, G. Ciottone.

This paper conducts a general analysis of the dataset, exploring different features via visualizations and statistics. The main findings are the distribution of casualties and injuries by continent and disaster type. They find that Asia has the most casualties, and that geophysical disasters cause the most deaths.

##### **Floods have become less deadly: an analysis of global flood fatalities 1975–2022** by S. N. Jonkman, A. Curran, L. M. Bouwer

This paper focuses on flood events, exploring casualties and economic impact over time. They also address the reporting bias in older data. The main finding is that floods have become less deadly over time, mainly due to better infrastructure.

##### Subnational Geocoding of Global Disasters Using Large Language Models by M. Roncoa, D. Delforgeb, W. S. Jägerc, C. Corbanea

This paper refines the geolocalisation of disaster events beyond EM-DAT's country-level data. Using GPT-4o and open map repositories, they successfully geocoded 14,000+ disasters automatically.

##### Inspiration for visualization

An immersive globe like [Google Maps Platform](https://mapsplatform.google.com/demos/3d-maps/), fun idea like region distortions proportional to impact [Worldmapper](https://worldmapper.org/maps/), and other interactive map styles from [Flourish]( https://flourish.studio/visualisations/maps/.).

##### Our work :

Our work offers a different view on this dataset, with easy-to-use and interactive visualizations. Like the first paper, we conduct a general analysis of observable patterns. We also could plan to enrich our data with external variables such as GDP, and to use subnational geolocation from the last paper for more precise mapping.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

