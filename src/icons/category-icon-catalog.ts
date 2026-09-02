import type { CategoryIconKey, ServiceCategory } from '../types'

import phoneIcon from './item-phone.svg'
import tabletIcon from './item-tablet.svg'
import laptopIcon from './item-laptop.svg'
import desktopIcon from './item-desktop.svg'
import monitorIcon from './item-monitor.svg'
import peripheralsIcon from '@material-symbols/svg-400/rounded/keyboard_alt.svg'
import computerPartsIcon from '@material-symbols/svg-400/rounded/memory.svg'
import wearableIcon from '@material-symbols/svg-400/rounded/devices_wearables.svg'
import computerIcon from '@material-symbols/svg-400/rounded/computer_arrow_up.svg'
import smartWatchIcon from './item-smart-watch.svg'
import headphonesIcon from './item-headphones.svg'
import cameraIcon from './item-camera.svg'
import gameDeviceIcon from './item-game-console.svg'
import gameIcon from '@material-symbols/svg-400/rounded/videogame_asset.svg'
import speakerIcon from './item-speaker.svg'
import keyboardIcon from './item-keyboard.svg'
import mouseIcon from './item-mouse.svg'
import applianceIcon from '@material-symbols/svg-400/rounded/power.svg'
import refrigeratorIcon from './item-refrigerator.svg'
import airConditionerIcon from './item-air-conditioner.svg'
import washingMachineIcon from './item-washing-machine.svg'
import televisionIcon from './item-television.svg'
import waterHeaterIcon from './item-water-heater.svg'
import microwaveIcon from './item-microwave.svg'
import riceCookerIcon from './item-rice-cooker.svg'
import ovenIcon from './item-oven.svg'
import vacuumCleanerIcon from './item-vacuum-cleaner.svg'
import robotVacuumIcon from './item-robot-vacuum.svg'
import airPurifierIcon from './item-air-purifier.svg'
import electricFanIcon from './item-electric-fan.svg'
import smallApplianceIcon from '@material-symbols/svg-400/rounded/coffee_maker.svg'
import fanHeaterIcon from '@material-symbols/svg-400/rounded/mode_fan.svg'
import furnitureIcon from '@material-symbols/svg-400/rounded/chair.svg'
import beddingIcon from '@material-symbols/svg-400/rounded/bed.svg'
import lightingIcon from '@material-symbols/svg-400/rounded/floor_lamp.svg'
import cookwareIcon from '@material-symbols/svg-400/rounded/skillet.svg'
import storageIcon from '@material-symbols/svg-400/rounded/inventory_2.svg'
import cleaningIcon from '@material-symbols/svg-400/rounded/cleaning_services.svg'
import clothingIcon from '@material-symbols/svg-400/rounded/checkroom.svg'
import shoesIcon from '@material-symbols/svg-400/rounded/steps.svg'
import bagIcon from '@material-symbols/svg-400/rounded/shopping_bag.svg'
import glassesIcon from '@material-symbols/svg-400/rounded/eyeglasses.svg'
import wristwatchIcon from '@material-symbols/svg-400/rounded/watch.svg'
import jewelryIcon from '@material-symbols/svg-400/rounded/diamond.svg'
import skincareIcon from '@material-symbols/svg-400/rounded/water_drop.svg'
import makeupIcon from '@material-symbols/svg-400/rounded/brush.svg'
import perfumeIcon from '@material-symbols/svg-400/rounded/fragrance.svg'
import shavingIcon from '@material-symbols/svg-400/rounded/content_cut.svg'
import dentalIcon from '@material-symbols/svg-400/rounded/dentistry.svg'
import medicineIcon from '@material-symbols/svg-400/rounded/pill.svg'
import healthDeviceIcon from '@material-symbols/svg-400/rounded/cardiology.svg'
import foodIcon from '@material-symbols/svg-400/rounded/lunch_dining.svg'
import coffeeIcon from '@material-symbols/svg-400/rounded/coffee.svg'
import teaIcon from '@material-symbols/svg-400/rounded/emoji_food_beverage.svg'
import wineIcon from '@material-symbols/svg-400/rounded/wine_bar.svg'
import freshIcon from '@material-symbols/svg-400/rounded/grocery.svg'
import nutritionIcon from '@material-symbols/svg-400/rounded/nutrition.svg'
import tablewareIcon from '@material-symbols/svg-400/rounded/dinner_dining.svg'
import seasoningIcon from '@material-symbols/svg-400/rounded/cooking.svg'
import carIcon from '@material-symbols/svg-400/rounded/directions_car.svg'
import bicycleIcon from '@material-symbols/svg-400/rounded/pedal_bike.svg'
import eBikeIcon from '@material-symbols/svg-400/rounded/electric_moped.svg'
import luggageIcon from '@material-symbols/svg-400/rounded/luggage.svg'
import ticketIcon from '@material-symbols/svg-400/rounded/confirmation_number.svg'
import commuteIcon from '@material-symbols/svg-400/rounded/train.svg'
import fitnessIcon from '@material-symbols/svg-400/rounded/fitness_center.svg'
import ballIcon from '@material-symbols/svg-400/rounded/sports_soccer.svg'
import campingIcon from '@material-symbols/svg-400/rounded/camping.svg'
import fishingIcon from '@material-symbols/svg-400/rounded/phishing.svg'
import skiingIcon from '@material-symbols/svg-400/rounded/downhill_skiing.svg'
import outdoorIcon from '@material-symbols/svg-400/rounded/hiking.svg'
import toolsIcon from '@material-symbols/svg-400/rounded/handyman.svg'
import powerToolsIcon from '@material-symbols/svg-400/rounded/tools_power_drill.svg'
import hammerIcon from '@material-symbols/svg-400/rounded/hardware.svg'
import gardeningIcon from '@material-symbols/svg-400/rounded/yard.svg'
import measuringIcon from '@material-symbols/svg-400/rounded/straighten.svg'
import repairIcon from '@material-symbols/svg-400/rounded/home_repair_service.svg'
import booksIcon from '@material-symbols/svg-400/rounded/auto_stories.svg'
import stationeryIcon from '@material-symbols/svg-400/rounded/edit_note.svg'
import instrumentIcon from '@material-symbols/svg-400/rounded/piano.svg'
import mediaIcon from '@material-symbols/svg-400/rounded/movie.svg'
import toyIcon from '@material-symbols/svg-400/rounded/toys_and_games.svg'
import modelKitIcon from '@material-symbols/svg-400/rounded/smart_toy.svg'
import figurineIcon from '@material-symbols/svg-400/rounded/chess_pawn.svg'
import boardGameIcon from '@material-symbols/svg-400/rounded/playing_cards.svg'
import collectibleIcon from '@material-symbols/svg-400/rounded/trophy.svg'
import idCardIcon from '@material-symbols/svg-400/rounded/badge.svg'
import receiptIcon from '@material-symbols/svg-400/rounded/receipt_long.svg'
import contractIcon from '@material-symbols/svg-400/rounded/contract.svg'
import memberCardIcon from '@material-symbols/svg-400/rounded/credit_card.svg'
import digitalVoucherIcon from '@material-symbols/svg-400/rounded/qr_code_2.svg'
import uncategorizedIcon from '@material-symbols/svg-400/rounded/category.svg'
import temporaryIcon from '@material-symbols/svg-400/rounded/package_2.svg'

import aiServiceIcon from './service-ai.svg'
import musicServiceIcon from './service-music.svg'
import videoServiceIcon from './service-video.svg'
import gameServiceIcon from './service-game.svg'
import cloudServiceIcon from './service-cloud.svg'
import softwareServiceIcon from './service-software.svg'
import learningServiceIcon from './service-learning.svg'
import lifestyleServiceIcon from './service-lifestyle.svg'
import otherServiceIcon from './service-other.svg'
import aiServiceDetailIcon from './service-ai-detail.svg'
import musicServiceDetailIcon from './service-music-detail.svg'
import videoServiceDetailIcon from './service-video-detail.svg'
import gameServiceDetailIcon from './service-game-detail.svg'
import cloudServiceDetailIcon from './service-cloud-detail.svg'
import softwareServiceDetailIcon from './service-software-detail.svg'
import learningServiceDetailIcon from './service-learning-detail.svg'
import lifestyleServiceDetailIcon from './service-lifestyle-detail.svg'
import otherServiceDetailIcon from './service-other-detail.svg'

export const itemCategoryIconUrls: Record<CategoryIconKey, string> = {
  phone: phoneIcon,
  tablet: tabletIcon,
  laptop: laptopIcon,
  desktop: desktopIcon,
  monitor: monitorIcon,
  peripherals: peripheralsIcon,
  'computer-parts': computerPartsIcon,
  wearable: wearableIcon,
  computer: computerIcon,
  'smart-watch': smartWatchIcon,
  headphones: headphonesIcon,
  camera: cameraIcon,
  'game-device': gameDeviceIcon,
  game: gameIcon,
  speaker: speakerIcon,
  keyboard: keyboardIcon,
  mouse: mouseIcon,
  appliance: applianceIcon,
  refrigerator: refrigeratorIcon,
  'air-conditioner': airConditionerIcon,
  'washing-machine': washingMachineIcon,
  television: televisionIcon,
  'water-heater': waterHeaterIcon,
  microwave: microwaveIcon,
  'rice-cooker': riceCookerIcon,
  oven: ovenIcon,
  'vacuum-cleaner': vacuumCleanerIcon,
  'air-purifier': airPurifierIcon,
  'electric-fan': electricFanIcon,
  'small-appliance': smallApplianceIcon,
  'fan-heater': fanHeaterIcon,
  'robot-vacuum': robotVacuumIcon,
  furniture: furnitureIcon,
  bedding: beddingIcon,
  lighting: lightingIcon,
  cookware: cookwareIcon,
  storage: storageIcon,
  cleaning: cleaningIcon,
  clothing: clothingIcon,
  shoes: shoesIcon,
  bag: bagIcon,
  glasses: glassesIcon,
  wristwatch: wristwatchIcon,
  jewelry: jewelryIcon,
  skincare: skincareIcon,
  makeup: makeupIcon,
  perfume: perfumeIcon,
  shaving: shavingIcon,
  dental: dentalIcon,
  medicine: medicineIcon,
  'health-device': healthDeviceIcon,
  food: foodIcon,
  coffee: coffeeIcon,
  tea: teaIcon,
  wine: wineIcon,
  fresh: freshIcon,
  nutrition: nutritionIcon,
  tableware: tablewareIcon,
  seasoning: seasoningIcon,
  car: carIcon,
  bicycle: bicycleIcon,
  'e-bike': eBikeIcon,
  luggage: luggageIcon,
  ticket: ticketIcon,
  commute: commuteIcon,
  fitness: fitnessIcon,
  ball: ballIcon,
  camping: campingIcon,
  fishing: fishingIcon,
  skiing: skiingIcon,
  outdoor: outdoorIcon,
  tools: toolsIcon,
  'power-tools': powerToolsIcon,
  hammer: hammerIcon,
  gardening: gardeningIcon,
  measuring: measuringIcon,
  repair: repairIcon,
  books: booksIcon,
  stationery: stationeryIcon,
  instrument: instrumentIcon,
  media: mediaIcon,
  toy: toyIcon,
  'model-kit': modelKitIcon,
  figurine: figurineIcon,
  'board-game': boardGameIcon,
  collectible: collectibleIcon,
  'id-card': idCardIcon,
  receipt: receiptIcon,
  contract: contractIcon,
  'member-card': memberCardIcon,
  'digital-voucher': digitalVoucherIcon,
  uncategorized: uncategorizedIcon,
  temporary: temporaryIcon,
}

export const serviceCategoryIconUrls: Record<ServiceCategory, string> = {
  AI服务: aiServiceIcon,
  音乐: musicServiceIcon,
  视频: videoServiceIcon,
  游戏: gameServiceIcon,
  云存储: cloudServiceIcon,
  软件工具: softwareServiceIcon,
  学习教育: learningServiceIcon,
  生活服务: lifestyleServiceIcon,
  其他: otherServiceIcon,
}

export const serviceCategoryDetailIconUrls: Record<ServiceCategory, string> = {
  AI服务: aiServiceDetailIcon,
  音乐: musicServiceDetailIcon,
  视频: videoServiceDetailIcon,
  游戏: gameServiceDetailIcon,
  云存储: cloudServiceDetailIcon,
  软件工具: softwareServiceDetailIcon,
  学习教育: learningServiceDetailIcon,
  生活服务: lifestyleServiceDetailIcon,
  其他: otherServiceDetailIcon,
}
