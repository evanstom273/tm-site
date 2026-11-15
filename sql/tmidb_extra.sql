
--
-- Indexes for dumped tables
--

--
-- Indexes for table `attempts`
--
ALTER TABLE `attempts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `contestant_introductions`
--
ALTER TABLE `contestant_introductions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `episodes`
--
ALTER TABLE `episodes`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `episode_alternate_titles`
--
ALTER TABLE `episode_alternate_titles`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `episode_points`
--
ALTER TABLE `episode_points`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `episode_points_official`
--
ALTER TABLE `episode_points_official`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `guests`
--
ALTER TABLE `guests`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `location_spaces`
--
ALTER TABLE `location_spaces`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `master_tasks`
--
ALTER TABLE `master_tasks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `media_embeds`
--
ALTER TABLE `media_embeds`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `people`
--
ALTER TABLE `people`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `podcast_appearances`
--
ALTER TABLE `podcast_appearances`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `seasons`
--
ALTER TABLE `seasons`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `season_points`
--
ALTER TABLE `season_points`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `season_points_official`
--
ALTER TABLE `season_points_official`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shows`
--
ALTER TABLE `shows`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `task_briefs`
--
ALTER TABLE `task_briefs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `task_points`
--
ALTER TABLE `task_points`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attempts`
--
ALTER TABLE `attempts`
  MODIFY `id` mediumint(6) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=11476;

--
-- AUTO_INCREMENT for table `contestant_introductions`
--
ALTER TABLE `contestant_introductions`
  MODIFY `id` smallint(4) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=629;

--
-- AUTO_INCREMENT for table `episodes`
--
ALTER TABLE `episodes`
  MODIFY `id` smallint(4) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=869;

--
-- AUTO_INCREMENT for table `episode_alternate_titles`
--
ALTER TABLE `episode_alternate_titles`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique ID', AUTO_INCREMENT=592;

--
-- AUTO_INCREMENT for table `episode_points`
--
ALTER TABLE `episode_points`
  MODIFY `id` mediumint(7) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=4976;

--
-- AUTO_INCREMENT for table `episode_points_official`
--
ALTER TABLE `episode_points_official`
  MODIFY `id` mediumint(7) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=4189;

--
-- AUTO_INCREMENT for table `guests`
--
ALTER TABLE `guests`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=183;

--
-- AUTO_INCREMENT for table `locations`
--
ALTER TABLE `locations`
  MODIFY `id` smallint(3) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=108;

--
-- AUTO_INCREMENT for table `location_spaces`
--
ALTER TABLE `location_spaces`
  MODIFY `id` smallint(3) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier.', AUTO_INCREMENT=101;

--
-- AUTO_INCREMENT for table `master_tasks`
--
ALTER TABLE `master_tasks`
  MODIFY `id` smallint(3) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=866;

--
-- AUTO_INCREMENT for table `media_embeds`
--
ALTER TABLE `media_embeds`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique row ID.', AUTO_INCREMENT=1599;

--
-- AUTO_INCREMENT for table `people`
--
ALTER TABLE `people`
  MODIFY `id` smallint(4) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=735;

--
-- AUTO_INCREMENT for table `podcast_appearances`
--
ALTER TABLE `podcast_appearances`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=241;

--
-- AUTO_INCREMENT for table `seasons`
--
ALTER TABLE `seasons`
  MODIFY `id` smallint(3) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=131;

--
-- AUTO_INCREMENT for table `season_points`
--
ALTER TABLE `season_points`
  MODIFY `id` mediumint(7) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=819;

--
-- AUTO_INCREMENT for table `season_points_official`
--
ALTER TABLE `season_points_official`
  MODIFY `id` mediumint(7) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=825;

--
-- AUTO_INCREMENT for table `shows`
--
ALTER TABLE `shows`
  MODIFY `id` tinyint(2) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=4501;

--
-- AUTO_INCREMENT for table `task_briefs`
--
ALTER TABLE `task_briefs`
  MODIFY `id` smallint(5) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=5669;

--
-- AUTO_INCREMENT for table `task_points`
--
ALTER TABLE `task_points`
  MODIFY `id` mediumint(7) NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier', AUTO_INCREMENT=21826;
