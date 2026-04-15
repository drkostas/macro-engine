--
-- PostgreSQL database dump
--

\restrict fU972oEQtoJYa9qANZ8s1KBq1e4gkG68xLCGCnqFm88g5wCgyviPLPvAfLNcl8H

-- Dumped from database version 17.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingredients (id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, is_raw, raw_to_cooked_ratio, category, usda_fdc_id, created_at, shrink_priority, unit, grams_per_unit, unit_step, is_favorite) FROM stdin;
bread_whole_wheat	Bread (whole wheat)	247	13	41	3.4	6	f	\N	carbs	168013	2026-03-14 21:52:33.742045-04	1	slice	30	0.25	f
popcorn_kernels	Popcorn Kernels (air-popped)	387	13	78	4.5	15	t	3	carbs	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
egg_whites_carton	Egg Whites (carton)	52	11	0.7	0.2	0	f	\N	protein	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
oats_dry	Oats (dry)	379	13.2	67.7	6.5	10.1	t	2.75	carbs	169745	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
cottage_cheese_4pct	Cottage Cheese 4%	98	11.1	3.4	4.3	0	f	\N	dairy	173417	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
chipotle_brown_rice	Chipotle Brown Rice	185	3.5	31.7	5.3	1.8	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	113	0.25	f
gu_vanilla_bean_caff	GU Energy Gel Vanilla Bean (Caffeine)	312.5	0	68.75	0	0	f	\N	supplement	\N	2026-03-21 16:57:58.980161-04	2	gel	32	0.25	f
energy_gel	Energy Gel	286	0	71	0	0	f	\N	supplement	\N	2026-03-14 21:52:33.742045-04	3	gel	32	0.25	f
purely_elizabeth_granola	Purely Elizabeth Granola	480	10	56	24	6	f	\N	carbs	174889	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
gatorlyte_powder	Gatorlyte Powder Packet	294	0	76.5	0	0	f	\N	drink	\N	2026-03-21 16:57:58.980161-04	2	pkt	17	0.25	f
white_rice_raw	White Rice (raw)	365	7.1	80	0.7	1.3	t	3	carbs	169756	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
ground_flaxseed	Ground Flaxseed	534	18.3	28.9	42.2	27.3	f	\N	grain	\N	2026-03-16 09:27:36.955873-04	1	g	\N	0.25	f
protein_powder_whey	Protein Powder (whey)	375	75	12.5	3.8	0	f	\N	supplement	173179	2026-03-14 21:52:33.742045-04	3	scoop	30	0.25	f
chipotle_white_rice	Chipotle White Rice	185	3.5	35.3	3.5	0.9	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
olive_oil	Olive Oil	884	0	0	100	0	f	\N	fat	171413	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
raos_arrabiata	Rao's Arrabiata Sauce	80	1.4	7	5.4	1.4	f	\N	sauce	\N	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
peanut_butter	Peanut Butter	588	25.1	20	50	6	f	\N	fat	174265	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
avocado	Avocado	160	2	8.5	14.7	6.7	f	\N	fat	171705	2026-03-14 21:52:33.742045-04	2	pcs	150	0.25	f
greek_yogurt_2pct	Greek Yogurt 2%	73	10	3.6	2	0	f	\N	dairy	170903	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
milk_2pct	Milk 2%	50	3.4	4.8	2	0	f	\N	dairy	173438	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
chipotle_fajita_veggies	Chipotle Fajita Vegetables	35	1.8	8.8	0	1.8	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
craft_beer_16oz	Craft Beer (16oz)	42	0	3.5	0	0	f	\N	drink	\N	2026-03-22 15:54:52.438565-04	2	pint	473	0.25	f
sports_drink	Sports Drink	26	0	6.4	0	0	f	\N	supplement	\N	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
salmon_raw	Salmon (raw)	208	20.4	0	13.4	0	t	0.84	protein	175167	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
ipa_beer_16oz	IPA Beer (16oz)	60	0	4	0	0	f	\N	drink	\N	2026-03-22 20:42:44.001585-04	2	pint	473	0.25	f
broccoli_raw	Broccoli (raw)	34	2.8	7	0.4	2.6	t	0.92	vegetable	170379	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
carrots_raw	Carrots (raw)	41	0.9	9.6	0.2	2.8	t	1	vegetable	170393	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
cherry_tomatoes	Cherry Tomatoes	18	0.9	3.9	0.2	1.2	t	0.87	vegetable	170457	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
cucumber	Cucumber	15	0.7	3.6	0.1	0.5	f	\N	vegetable	168409	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
spinach	Spinach	23	2.9	3.6	0.4	2.2	f	\N	vegetable	\N	2026-03-16 09:27:36.955873-04	99	g	\N	0.25	f
honey	Honey	304	0.3	82.4	0	0.2	f	\N	carbs	\N	2026-03-16 15:51:50.059269-04	1	g	\N	0.25	f
chipotle_mild_salsa	Chipotle Fresh Tomato Salsa (Mild)	26	0	7	0	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
frozen_mixed_berries	Frozen Mixed Berries	49	1.1	12.6	0.3	3.7	f	\N	fruit	\N	2026-03-16 09:27:36.955873-04	1	g	\N	0.25	f
greek_yogurt_0pct	Greek Yogurt 0%	54	10	3.4	0.2	0	f	\N	dairy	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
yellow_mustard	Yellow Mustard	66	4.4	5.3	3.3	3.3	f	\N	sauce	\N	2026-03-20 22:57:40.58265-04	2	g	\N	0.25	f
powerade_zero_berry	Powerade Zero Mixed Berry	0	0	0	0	0	f	\N	drink	\N	2026-03-21 16:57:58.980161-04	2	g	\N	0.25	f
flock_double_smash	Flock Double Smash Burger (w/ bun)	240	14	10	16	0.5	f	\N	restaurant	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
flock_wings_6pc	Flock Wings (6pc buffalo/soy ginger)	225	15	5	7.5	0	f	\N	restaurant	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
steamed_broccolini	Steamed Broccolini	35	4	7	0.4	3.3	f	\N	vegetable	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
flock_charcuterie_third	Charcuterie & Cheese Platter (1/3 share)	350	18	8	28	0.5	f	\N	restaurant	\N	2026-03-22 20:42:44.001585-04	2	g	\N	0.25	f
chocolate_mousse	Chocolate Mousse	195	3.5	22	10	1	f	\N	dessert	\N	2026-03-22 20:42:44.001585-04	2	g	\N	0.25	f
banana	Banana	89	1.1	22.8	0.3	2.6	f	\N	fruit	173944	2026-03-14 21:52:33.742045-04	1	pcs	118	0.25	f
green_apple	Green Apple (Granny Smith)	52	0.3	13.6	0.2	2.4	f	\N	fruit	\N	2026-03-25 17:11:18.515874-04	2	pcs	180	0.25	f
orange	Orange	47	0.9	11.8	0.1	2.4	f	\N	fruit	\N	2026-03-14 21:52:33.742045-04	1	pcs	130	0.25	f
lemon	Lemon	29	1.1	9.3	0.3	2.8	f	\N	fruit	\N	2026-03-20 16:46:06.506887-04	2	pcs	58	0.25	f
canned_tuna_water	Canned Albacore Tuna (water)	128	23.6	0	3	0	f	\N	protein	\N	2026-03-16 09:27:36.955873-04	3	can	125	1	f
rice_cakes	Rice Cakes	387	8	81.1	2.8	4.2	f	\N	carbs	\N	2026-03-20 16:46:06.506887-04	2	pcs	9	0.25	f
chipotle_fresh_salsa	Chipotle Fresh Tomato Salsa	6	0	1	0	0.5	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	400	0.25	f
chipotle_chicken	Chipotle Chicken	159	28.2	0	6.2	0	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	113	0.25	f
chipotle_lettuce	Chipotle Romaine Lettuce	14	1.4	2.8	0	1.4	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	71	0.25	f
chipotle_tortilla	Chipotle Flour Tortilla	267	6.7	41.7	7.5	2.5	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	pcs	120	0.25	f
chipotle_black_beans	Chipotle Black Beans	115	7.1	19.5	1.3	6.2	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_pinto_beans	Chipotle Pinto Beans	115	7.1	18.6	1.3	7.1	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_steak	Chipotle Steak	132	18.5	0.9	5.3	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_barbacoa	Chipotle Barbacoa	150	21.2	1.8	6.2	0.9	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_carnitas	Chipotle Carnitas	185	20.3	0	10.6	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_sofritas	Chipotle Sofritas	123	7	8.8	8.8	3.5	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
eggs_whole	Whole Egg (with yolk)	143	12.6	0.7	9.5	0	f	1	protein	171287	2026-03-14 21:52:33.742045-04	3	egg	50	1	f
egg_whites	Egg Whites (no yolk)	52	11	0.7	0.2	0	f	\N	protein	\N	2026-03-17 10:01:10.185513-04	3	egg	33	1	f
chipotle_cheese	Chipotle Cheese	353	28.2	0	30	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	28	0.25	f
chipotle_sour_cream	Chipotle Sour Cream	212	3.5	3.5	17.6	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chipotle_guacamole	Chipotle Guacamole	151	2	8.1	13.1	6.1	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	99	0.25	f
chipotle_corn_salsa	Chipotle Roasted Corn Salsa	81	3	15.2	1.5	3	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	99	0.25	f
chipotle_green_salsa	Chipotle Green Tomatillo Salsa	26	1.8	5.3	0	1.8	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chipotle_red_salsa	Chipotle Red Tomatillo Salsa	44	1.8	8.8	0.9	3.5	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chia_seeds	Chia Seeds	486	17	42	31	34	f	\N	grain	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
cottage_cheese_2pct	Cottage Cheese 2%	86	12	4	2.3	0	f	\N	dairy	\N	2026-03-31 20:55:13.131888-04	2	g	\N	0.25	f
sweet_potato_raw	Sweet Potato (raw)	86	1.6	20	0.1	3	t	0.8	carbs	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
quinoa_dry	Quinoa (dry)	368	14	64	6	7	t	2.75	carbs	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
cod_raw	Cod Fish (raw)	82	18	0	0.7	0	t	0.8	protein	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
chicken_breast_raw	Chicken Breast (raw)	120	22.5	0	2.6	0	t	0.72	protein	171077	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	t
\.


--
-- Data for Name: preset_meals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.preset_meals (id, name, items, tags, meal_slot, total_calories, total_protein, total_carbs, total_fat, total_fiber, is_system, use_count, created_at) FROM stdin;
protein_oats	Protein Oats	{"fat": 10.6, "carbs": 82.9, "fiber": 9.5, "items": [{"grams": 60, "ingredient_id": "oats_dry"}, {"grams": 30, "ingredient_id": "protein_powder_whey"}, {"grams": 250, "ingredient_id": "milk_2pct"}, {"grams": 120, "ingredient_id": "banana"}], "protein": 42.5, "calories": 577.7}	{breakfast}	breakfast	577.7	42.5	82.9	10.6	9.5	t	0	2026-03-14 21:52:33.742045-04
yogurt_snack_bowl	Yogurt Snack Bowl	{"fat": 8.9, "carbs": 15.2, "fiber": 2.2, "items": [{"grams": 200, "ingredient_id": "greek_yogurt_2pct"}, {"grams": 80, "ingredient_id": "carrots_raw"}, {"grams": 50, "ingredient_id": "eggs_whole"}], "protein": 27.0, "calories": 250.3}	{snack,evening}	snack	250.3	27	15.2	8.9	2.2	t	0	2026-03-14 21:52:33.742045-04
pre_sleep_cottage	Pre-Sleep Cottage	{"fat": 4.6, "carbs": 8.6, "fiber": 0.0, "items": [{"grams": 200, "ingredient_id": "cottage_cheese_2pct"}], "protein": 23.6, "calories": 172.0}	{snack,evening}	pre_sleep	172	23.6	8.6	4.6	0	t	0	2026-03-14 21:52:33.742045-04
emergency_munchies_box	Emergency Munchies Box	{"fat": 5.3, "carbs": 23.0, "fiber": 1.6, "items": [{"grams": 200, "ingredient_id": "greek_yogurt_2pct"}, {"grams": 60, "ingredient_id": "banana"}, {"grams": 50, "ingredient_id": "cottage_cheese_2pct"}], "protein": 26.6, "calories": 242.4}	{snack,evening,emergency}	snack	242.4	26.6	23	5.3	1.6	t	0	2026-03-14 21:52:33.742045-04
energy_gel_single	Energy Gel	{"fat": 0.0, "carbs": 24.8, "fiber": 0.0, "items": [{"grams": 35, "ingredient_id": "energy_gel"}], "protein": 0.0, "calories": 100.1}	{pre-run,during-run}	during_workout	100.1	0	24.8	0	0	t	0	2026-03-14 21:52:33.742045-04
sports_drink_bottle	Sports Drink (500ml)	{"fat": 0.0, "carbs": 32.0, "fiber": 0.0, "items": [{"grams": 500, "ingredient_id": "sports_drink"}], "protein": 0.0, "calories": 130.0}	{during-run,post-run}	during_workout	130	0	32	0	0	t	0	2026-03-14 21:52:33.742045-04
banana_single	Banana	{"fat": 0.4, "carbs": 27.4, "fiber": 3.1, "items": [{"grams": 120, "ingredient_id": "banana"}], "protein": 1.3, "calories": 107}	{breakfast,snack}	breakfast	107	1	27	0	3	t	0	2026-03-15 14:43:17.924189-04
purely_elizabeth_granola_yogurt_whey_1773712616860	Purely Elizabeth Granola, Yogurt & Whey	{"fat": 11, "carbs": 32, "fiber": 4, "items": [{"fat": 7.2, "carbs": 16.8, "fiber": 1.8, "grams": 30, "protein": 3, "calories": 144, "ingredient_id": "purely_elizabeth_granola"}, {"fat": 3, "carbs": 5.4, "fiber": 0, "grams": 150, "protein": 15, "calories": 110, "ingredient_id": "greek_yogurt_2pct"}, {"fat": 0.2, "carbs": 6.8, "fiber": 1.8, "grams": 50, "protein": 0.4, "calories": 29, "ingredient_id": "frozen_mixed_berries"}, {"fat": 1, "carbs": 3.1, "fiber": 0, "grams": 25, "protein": 18.8, "calories": 94, "ingredient_id": "protein_powder_whey"}], "protein": 37, "calories": 377}	{pre_sleep}	pre_sleep	377	37	32	11	4	f	0	2026-03-16 21:56:56.954151-04
yogurt_egg_whites_avocado_1773757128542	Yogurt, Egg Whites & Avocado	{"fat": 17, "carbs": 28, "fiber": 8, "items": [{"fat": 1, "carbs": 12.3, "fiber": 1.8, "grams": 30, "protein": 3.9, "calories": 74, "ingredient_id": "bread_whole_wheat"}, {"fat": 3.5, "carbs": 6.3, "fiber": 0, "grams": 175, "protein": 17.5, "calories": 128, "ingredient_id": "greek_yogurt_2pct"}, {"fat": 8.1, "carbs": 4.7, "fiber": 3.7, "grams": 55, "protein": 1.1, "calories": 88, "ingredient_id": "avocado"}, {"fat": 4.2, "carbs": 2.9, "fiber": 2.7, "grams": 10, "protein": 1.8, "calories": 53, "ingredient_id": "ground_flaxseed"}, {"fat": 0.4, "carbs": 1.4, "fiber": 0, "grams": 198, "protein": 21.8, "calories": 103, "ingredient_id": "egg_whites"}], "protein": 46, "calories": 446}	{breakfast}	breakfast	446	46	28	17	8	f	0	2026-03-17 10:18:48.931367-04
whey_milk_oats_1773838735072	Whey, Milk & Oats	{"fat": 13, "carbs": 46, "fiber": 7, "items": [{"fat": 2.1, "carbs": 19.9, "fiber": 3.2, "grams": 30, "protein": 5.1, "calories": 117, "ingredient_id": "oats_dry"}, {"fat": 5, "carbs": 12, "fiber": 0, "grams": 250, "protein": 8.5, "calories": 125, "ingredient_id": "milk_2pct"}, {"fat": 0.1, "carbs": 5.7, "fiber": 0.7, "grams": 25, "protein": 0.3, "calories": 22, "ingredient_id": "banana"}, {"fat": 4.2, "carbs": 2.9, "fiber": 2.7, "grams": 10, "protein": 1.8, "calories": 53, "ingredient_id": "ground_flaxseed"}, {"fat": 1.5, "carbs": 5, "fiber": 0, "grams": 40, "protein": 30, "calories": 150, "ingredient_id": "protein_powder_whey"}], "protein": 46, "calories": 467}	{breakfast}	breakfast	467	46	46	13	7	f	0	2026-03-18 08:58:55.420804-04
preset_1775132301462_1xe9ce	Oats, Chia Seeds & Orange	{"fat": 15, "carbs": 74, "fiber": 14, "items": [{"fat": 3.3, "carbs": 33.9, "fiber": 5.1, "grams": 50, "protein": 6.6, "calories": 190, "ingredient_id": "oats_dry"}, {"fat": 5, "carbs": 12, "fiber": 0, "grams": 250, "protein": 8.5, "calories": 125, "ingredient_id": "milk_2pct"}, {"fat": 0.1, "carbs": 15.3, "fiber": 3.1, "grams": 130, "protein": 1.2, "calories": 61, "ingredient_id": "orange"}, {"fat": 5.3, "carbs": 7.1, "fiber": 5.8, "grams": 17, "protein": 2.9, "calories": 83, "ingredient_id": "chia_seeds"}, {"fat": 1.7, "carbs": 5.6, "fiber": 0, "grams": 45, "protein": 33.8, "calories": 169, "ingredient_id": "protein_powder_whey"}], "protein": 53, "calories": 628}	{breakfast}	breakfast	628	53	74	15	14	f	0	2026-04-02 08:18:21.472757-04
preset_1773923959032_y69wnu	Optimal Avovado toast	{"fat": 15, "carbs": 50, "fiber": 10, "items": [{"fat": 3.1, "carbs": 36.9, "fiber": 5.4, "grams": 90, "protein": 11.7, "calories": 222, "ingredient_id": "bread_whole_wheat"}, {"fat": 2, "carbs": 3.6, "fiber": 0, "grams": 100, "protein": 10, "calories": 73, "ingredient_id": "greek_yogurt_2pct"}, {"fat": 7.4, "carbs": 4.3, "fiber": 3.4, "grams": 50, "protein": 1, "calories": 80, "ingredient_id": "avocado"}, {"fat": 1.3, "carbs": 0.9, "fiber": 0.8, "grams": 3, "protein": 0.5, "calories": 16, "ingredient_id": "ground_flaxseed"}, {"fat": 0.3, "carbs": 0.9, "fiber": 0, "grams": 132, "protein": 14.5, "calories": 69, "ingredient_id": "egg_whites"}, {"fat": 1.1, "carbs": 3.8, "fiber": 0, "grams": 30, "protein": 22.5, "calories": 113, "ingredient_id": "protein_powder_whey"}], "protein": 60, "calories": 573}	{breakfast}	breakfast	573	60	50	15	10	f	0	2026-03-19 08:39:19.260957-04
preset_1773943494028_87bbrz	Oats, Milk & Whey	{"fat": 9, "carbs": 52, "fiber": 6, "items": [{"fat": 4.1, "carbs": 39.8, "fiber": 6.4, "grams": 60, "protein": 10.1, "calories": 233, "ingredient_id": "oats_dry"}, {"fat": 3.5, "carbs": 8.4, "fiber": 0, "grams": 175, "protein": 6, "calories": 88, "ingredient_id": "milk_2pct"}, {"fat": 1.1, "carbs": 3.8, "fiber": 0, "grams": 30, "protein": 22.5, "calories": 113, "ingredient_id": "protein_powder_whey"}], "protein": 39, "calories": 434}	{pre_sleep}	pre_sleep	434	39	52	9	6	f	0	2026-03-19 14:04:54.171156-04
preset_1773957796318_nj0o5i	Energy Gel	{"fat": 0, "carbs": 25, "fiber": 0, "items": [{"fat": 0, "carbs": 24.8, "fiber": 0, "grams": 35, "protein": 0, "calories": 100, "ingredient_id": "energy_gel"}], "protein": 0, "calories": 100}	{lunch}	lunch	100	0	25	0	0	f	0	2026-03-19 18:03:16.334614-04
preset_1773970596363_eadsdp	Oats, Frozen Mixed Berries & Milk & Protein	{"fat": 9, "carbs": 53, "fiber": 8, "items": [{"fat": 2.1, "carbs": 19.9, "fiber": 3.2, "grams": 30, "protein": 5.1, "calories": 117, "ingredient_id": "oats_dry"}, {"fat": 5, "carbs": 12, "fiber": 0, "grams": 250, "protein": 8.5, "calories": 125, "ingredient_id": "milk_2pct"}, {"fat": 0.4, "carbs": 17, "fiber": 4.5, "grams": 125, "protein": 0.9, "calories": 71, "ingredient_id": "frozen_mixed_berries"}, {"fat": 1.1, "carbs": 3.8, "fiber": 0, "grams": 30, "protein": 22.5, "calories": 113, "ingredient_id": "protein_powder_whey"}], "protein": 37, "calories": 426}	{pre_sleep}	pre_sleep	426	37	53	9	8	f	0	2026-03-19 21:36:36.569604-04
preset_1774321536228_66pz2q	Popcorn Kernels	{"fat": 2, "carbs": 31, "fiber": 6, "items": [{"fat": 1.8, "carbs": 31.2, "fiber": 6, "grams": 40, "protein": 5.2, "calories": 155, "ingredient_id": "popcorn_kernels"}], "protein": 5, "calories": 155}	{pre_sleep}	pre_sleep	155	5	31	2	6	f	0	2026-03-23 23:05:36.495747-04
preset_1775101918943_q1bcdy	Popcorn	{"fat": 3, "carbs": 47, "fiber": 9, "items": [{"fat": 2.7, "carbs": 46.8, "fiber": 9, "grams": 60, "protein": 7.8, "calories": 232, "ingredient_id": "popcorn_kernels"}], "protein": 8, "calories": 232}	{pre_sleep}	pre_sleep	232	8	47	3	9	f	0	2026-04-01 23:51:58.959373-04
preset_1775149904739_74bhob	Chicken Breast, Sweet Potato, Cottage, Broccoli, Carrots	{"fat": 6, "carbs": 48, "fiber": 10, "items": [{"fat": 0.1, "carbs": 25, "fiber": 3.8, "grams": 125, "protein": 2, "calories": 108, "ingredient_id": "sweet_potato_raw"}, {"fat": 1.7, "carbs": 3, "fiber": 0, "grams": 75, "protein": 9, "calories": 65, "ingredient_id": "cottage_cheese_2pct"}, {"fat": 3.9, "carbs": 0, "fiber": 0, "grams": 150, "protein": 33.8, "calories": 180, "ingredient_id": "chicken_breast_raw"}, {"fat": 0.5, "carbs": 8.4, "fiber": 3.1, "grams": 120, "protein": 3.4, "calories": 41, "ingredient_id": "broccoli_raw"}, {"fat": 0.2, "carbs": 11.5, "fiber": 3.4, "grams": 120, "protein": 1.1, "calories": 49, "ingredient_id": "carrots_raw"}], "protein": 49, "calories": 443}	{lunch}	lunch	443	49	48	6	10	f	0	2026-04-02 13:11:44.747706-04
preset_1775169901774_3l8eb1	Rice Cakes & Honey	{"fat": 0, "carbs": 16, "fiber": 0, "items": [{"fat": 0, "carbs": 8.2, "fiber": 0, "grams": 10, "protein": 0, "calories": 30, "ingredient_id": "honey"}, {"fat": 0.3, "carbs": 7.3, "fiber": 0.4, "grams": 9, "protein": 0.7, "calories": 35, "ingredient_id": "rice_cakes"}], "protein": 1, "calories": 65}	{lunch}	lunch	65	1	16	0	0	f	0	2026-04-02 18:45:01.7769-04
preset_1776122419619_u4a9gx	Chicken, Cottage, Tomatoes & Eggs	{"fat": 9, "carbs": 9, "fiber": 1, "items": [{"fat": 3.5, "carbs": 6, "fiber": 0, "grams": 150, "protein": 18, "calories": 129, "ingredient_id": "cottage_cheese_2pct"}, {"fat": 5.4, "carbs": 0, "fiber": 0, "grams": 208, "protein": 46.8, "calories": 250, "ingredient_id": "chicken_breast_raw"}, {"fat": 0.2, "carbs": 0.7, "fiber": 0, "grams": 99, "protein": 10.9, "calories": 51, "ingredient_id": "egg_whites"}, {"fat": 0.1, "carbs": 2.2, "fiber": 0.7, "grams": 57, "protein": 0.5, "calories": 10, "ingredient_id": "cherry_tomatoes"}], "protein": 76, "calories": 440}	{dinner}	dinner	440	76	9	9	1	f	0	2026-04-13 19:20:19.62848-04
\.


--
-- PostgreSQL database dump complete
--

\unrestrict fU972oEQtoJYa9qANZ8s1KBq1e4gkG68xLCGCnqFm88g5wCgyviPLPvAfLNcl8H

