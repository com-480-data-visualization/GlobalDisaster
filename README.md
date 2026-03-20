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

> Find a dataset (or multiple) that you will explore. Assess the quality of the data it contains and how much preprocessing / data-cleaning it will require before tackling visualization. We recommend using a standard dataset as this course is not about scraping nor data processing.
>
> Hint: some good pointers for finding quality publicly available datasets ([Google dataset search](https://datasetsearch.research.google.com/), [Kaggle](https://www.kaggle.com/datasets), [OpenSwissData](https://opendata.swiss/en/), [SNAP](https://snap.stanford.edu/data/) and [FiveThirtyEight](https://data.fivethirtyeight.com/)).

For our project, we chose the em-dat dataset, provided by the centre for research on the epidemiology of disasters (cred). em-dat is an open-access database for non-commercial use that tracks disasters worldwide, based on sources such as un agencies, ngos, research institutes, reinsurance companies, and press agencies. While the full database contains more than 27,000 disaster records, our work focuses only on natural disasters, which gives us a dataset of around 17,000 records.

We chose this dataset because it is large, well known, and contains useful variables for visualization, such as disaster type, country, year, deaths, affected people, and sometimes economic damage. From our first exploration, the dataset seems overall good quality, but some columns have many missing values, especially for older events and for variables like costs or coordinates. Because of that, some preprocessing will be needed, mainly cleaning missing values, formatting dates, and keeping the most complete variables.

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

With this project, we want to show how recorded natural disasters are distributed across time and space, and how their effects can vary depending on the region and the type of disaster. Our main idea is to help people see the bigger picture: not only where disasters are reported, but also which ones seem to have the strongest human impact.

Our motivation comes from the fact that natural disasters are usually seen one by one in the news, while the global patterns are less visible. At the same time, we want to be careful not to over-interpret the data, since a higher number of recorded events does not always mean that disasters truly became more frequent, but can also reflect better reporting over time. Using this dataset, we want to build a visualization that makes these patterns easier to explore and understand while keeping these limits in mind. Our target audience is mainly the general public who want a simple and interactive way to learn more about natural disasters.

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

Our first exploratory analysis was mainly used to check the structure of the dataset and identify which variables are the most reliable for the project. After cleaning the column names and inspecting the table, we found that the dataset is overall well structured. In particular, we did not find duplicated rows or duplicated disaster ids, which is a good sign for consistency. The main descriptive variables that we want to use, such as country, region, disaster type, and year, are generally complete enough for visualization.
<p align="center">
<img height="350" alt="image" src="https://github.com/user-attachments/assets/8e0be793-80c2-4408-a9c2-16bb69737416" />
</p>

The main issue we found is missing data. This is especially true for variables related to economic damage, coordinates, and some impact measures, while the core descriptive fields are much more complete. This confirms that the first version of our visualizations should rely mostly on variables such as year, country, region, disaster type, total deaths, and total affected. More incomplete variables, especially financial ones, will need to be used more carefully.
<p align="center">
<img height="305" alt="image" src="https://github.com/user-attachments/assets/a35e3197-2f85-4d17-ba0b-9040168d249a" />
</p>

A first important pattern is the strong increase in the number of recorded natural disasters over time, especially in the second half of the 20th century and after. However, this result should be interpreted carefully. It does not necessarily mean that disasters truly became more frequent, since part of this increase may also come from better reporting, monitoring, and data collection in recent decades. For this reason, our project focuses on recorded disasters rather than making direct claims about the absolute evolution of all disasters.
<p align="center">
<img height="375" alt="image" src="https://github.com/user-attachments/assets/8035677b-1a91-47d9-88ce-1381ebc1f80b" />
</p>

The exploratory analysis also shows that disaster types are not evenly represented. Floods and storms are by far the most frequent categories in the dataset, especially in recent decades, while other types such as earthquakes, droughts, or epidemics appear less often. This suggests that one important axis of the project will be to compare not only the number of recorded events, but also how different disaster types contribute differently to human impact.
<p align="center">
<img height="500" alt="newplot" src="https://github.com/user-attachments/assets/2c792276-f2be-45d1-aa80-523dd013ea7b" />
</p>

Finally, the spatial distribution of the data is very uneven. Some countries, such as the united states, china, and india, contain many more recorded events than others. Here again, this should not be interpreted too quickly as a direct measure of real exposure only, since reporting capacity, country size, and data availability can also influence these counts. Overall, this exploratory analysis helped us confirm that the dataset is suitable for our project, while also showing the main limitations that we need to keep in mind during the visualization design.

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

This public dataset has already been studied several times with interesting insights. Here are few works and the main conclusions that they bring : 

- Natural disasters: a comprehensive study using EMDAT database 1995-2022, by D.Tin, L. Cheng, D. Le, R. Hata, G. Ciottone.

This paper conducts a quite generic analysis of the dataset, exploring different features via different visualizations and different statistics. The main findings are the distribution in terms of casualties and injuries by continent and by disaster type. They find that the continent with most casualties is Asia, and the disaster type causing most deaths are the geophysical ones.

- Floods have become less deadly: an analysis of global flood fatalities 1975–2022 by S. N. Jonkman, A. Curran, L. M. Bouwer

This paper focuses on a specific type of disaster : flood events. They briefly compare floods to other disaster type, and explore the different tendencies in flood disaster : casualties, economical impact... They also analyze that there is more floods, but they adress the limitation about the registration of data : disaster events are more and better registrated today than in the years of the beginning of the dataset (1980's). The main finding is that floods have become less deathly over time, mainly due to better infrastructures.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

